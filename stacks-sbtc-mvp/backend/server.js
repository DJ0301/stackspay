import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import { callReadOnlyFunction, cvToValue, uintCV, principalCV } from '@stacks/transactions';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
// Disable HTTP caching to avoid 304s during frontend polling loops
app.disable('etag');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});


// Configuration
const PORT = process.env.PORT || 3001;
const NETWORK = process.env.NETWORK || 'testnet';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = process.env.CONTRACT_NAME || 'sbtc-payment-gateway-new';
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS || CONTRACT_ADDRESS;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'webhook-secret';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const network = NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet();

// Transaction monitoring service
class TransactionMonitor {
  constructor() {
    this.apiBaseUrl = NETWORK === 'mainnet' 
      ? 'https://api.hiro.so' 
      : 'https://api.testnet.hiro.so';
  }

  async getTransactionStatus(txId) {
    try {
      console.log(`[TX_MONITOR] Fetching status for txId: ${txId}`);
      const response = await axios.get(`${this.apiBaseUrl}/extended/v1/tx/${txId}`);
      console.log(`[TX_MONITOR] API response status: ${response.status}`);
      console.log(`[TX_MONITOR] Transaction data:`, {
        tx_id: response.data.tx_id,
        tx_status: response.data.tx_status,
        block_height: response.data.block_height,
        microblock_sequence: response.data.microblock_sequence,
        burn_block_time_iso: response.data.burn_block_time_iso
      });
      return response.data;
    } catch (error) {
      console.error(`[TX_MONITOR] Error fetching transaction ${txId}:`, error.response?.status, error.response?.data || error.message);

      // If the transaction is not found, it might be a different txId
      if (error.response?.status === 404) {
        console.log(`[TX_MONITOR] Transaction ${txId} not found. This might be a wallet-specific ID that differs from on-chain ID.`);
      }

      return null;
    }
  }

  async searchTransactionByCriteria(criteria) {
    try {
      console.log(`[TX_MONITOR] Searching for transaction by criteria:`, criteria);

      // Search by contract call parameters
      if (criteria.contract && criteria.functionName) {
        const response = await axios.get(`${this.apiBaseUrl}/extended/v1/tx/mempool`, {
          params: {
            contract_call: {
              contract_id: criteria.contract,
              function_name: criteria.functionName
            },
            limit: 50
          }
        });

        const txs = response.data?.results || [];
        console.log(`[TX_MONITOR] Found ${txs.length} mempool transactions for contract ${criteria.contract}`);

        // Filter by recent transactions (last 5 minutes)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const recentTxs = txs.filter(tx => {
          const txTime = new Date(tx.receipt_time).getTime();
          return txTime > fiveMinutesAgo;
        });

        if (recentTxs.length > 0) {
          console.log(`[TX_MONITOR] Found ${recentTxs.length} recent transactions`);
          return recentTxs[0]; // Return the most recent one
        }
      }

      return null;
    } catch (error) {
      console.error(`[TX_MONITOR] Error searching for transaction:`, error.message);
      return null;
    }
  }

  async waitForConfirmation(txId, maxAttempts = 30, intervalMs = 10000) {
    console.log(`[TX_MONITOR] Starting confirmation monitoring for txId: ${txId}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const txData = await this.getTransactionStatus(txId);

      if (txData) {
        console.log(`[TX_MONITOR] Attempt ${attempt + 1}/${maxAttempts} - Transaction status: ${txData.tx_status}`);

        if (txData.tx_status === 'success') {
          console.log(`[TX_MONITOR] Transaction confirmed! Block: ${txData.block_height}`);
          return {
            confirmed: true,
            txId: txData.tx_id,
            blockHeight: txData.block_height,
            blockHash: txData.block_hash
          };
        } else if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
          console.log(`[TX_MONITOR] Transaction failed: ${txData.tx_status}`);
          return {
            confirmed: false,
            error: `Transaction failed: ${txData.tx_status}`,
            txId: txData.tx_id
          };
        }
      } else {
        console.log(`[TX_MONITOR] Attempt ${attempt + 1}/${maxAttempts} - No transaction data received`);
      }

      // Wait before next attempt
      if (attempt < maxAttempts - 1) {
        console.log(`[TX_MONITOR] Waiting ${intervalMs/1000}s before next check...`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    console.log(`[TX_MONITOR] Confirmation timeout after ${maxAttempts} attempts`);
    return {
      confirmed: false,
      error: 'Transaction confirmation timeout',
      txId
    };
  }

  async monitorPaymentTransaction(paymentId, txId) {
    console.log(`[TX_MONITOR] Starting transaction monitoring for payment ${paymentId}, txId: ${txId}`);
    
    const result = await this.waitForConfirmation(txId);
    
    try {
      const payment = await Payment.findOne({ id: paymentId });
      if (payment) {
        if (result.confirmed) {
          payment.confirmedTxId = result.txId;
          payment.status = 'completed';
          console.log(`[TX_MONITOR] Payment ${paymentId} confirmed with txId: ${result.txId}`);
          
          // Update payment link usage count if this payment was created from a payment link
          const paymentLinkId = payment.metadata?.paymentLinkId;
          if (paymentLinkId) {
            try {
              await PaymentLink.findOneAndUpdate(
                { id: paymentLinkId },
                { $inc: { usageCount: 1 } }
              );
              console.log(`[TX_MONITOR] Incremented usage count for payment link ${paymentLinkId}`);
            } catch (linkError) {
              console.error(`[TX_MONITOR] Error updating payment link usage:`, linkError);
            }
          }

          // Update product payment count if this payment was created from a product
          const productId = payment.metadata?.productId;
          if (productId) {
            try {
              await Product.findOneAndUpdate(
                { id: productId },
                { $inc: { paymentCount: 1 } }
              );
              console.log(`[TX_MONITOR] Incremented payment count for product ${productId}`);
            } catch (productError) {
              console.error(`[TX_MONITOR] Error updating product payment count:`, productError);
            }
          }

          // Update customer spending data if this is a checkout payment
          if (payment.metadata?.customerEmail && payment.metadata?.checkoutType === 'product') {
            try {
              await Customer.findOneAndUpdate(
                { 
                  email: payment.metadata.customerEmail,
                  merchantAddress: payment.merchantAddress 
                },
                { 
                  $inc: { 
                    totalSpent: payment.amount || 0,
                    orderCount: 1 
                  },
                  $set: { 
                    lastPurchaseDate: new Date(),
                    status: 'active'
                  }
                },
                { upsert: false }
              );
              console.log(`[TX_MONITOR] Updated customer spending for ${payment.metadata.customerEmail}: +${payment.amount} sBTC`);
            } catch (customerError) {
              console.error(`[TX_MONITOR] Error updating customer spending:`, customerError);
            }
          }
        } else {
          payment.status = 'failed';
          console.log(`[TX_MONITOR] Payment ${paymentId} failed: ${result.error}`);
        }
        await payment.save();
        
        // Trigger webhook with updated status
        await webhookService.trigger(
          result.confirmed ? 'payment.confirmed' : 'payment.failed', 
          payment.toObject()
        );
      }
    } catch (error) {
      console.error(`[TX_MONITOR] Error updating payment ${paymentId}:`, error);
    }
    
    return result;
  }
}

const transactionMonitor = new TransactionMonitor();

// MongoDB Models
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sbtc-gateway');

const PaymentSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  amount: Number,
  amountUSD: Number,
  status: { type: String, enum: ['pending', 'completed', 'failed', 'expired'], default: 'pending' },
  merchantAddress: String,
  customerAddress: String,
  txId: String,
  confirmedTxId: String, // The actual on-chain confirmed transaction ID
  metadata: Object,
  description: String,
  customerEmail: String,
  paymentLink: String,
  paymentMethod: { type: String, default: 'sbtc' },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
  expiresAt: Date
});

const PaymentLinkSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  name: String,
  description: String,
  amount: Number,
  amountUSD: Number,
  merchantAddress: String,
  isActive: { type: Boolean, default: true },
  allowCustomAmount: { type: Boolean, default: false },
  minAmount: Number,
  maxAmount: Number,
  metadata: Object,
  successUrl: String,
  cancelUrl: String,
  webhookUrl: String,
  usageLimit: Number,
  usageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

// Product Schema (sBTC is primary)
const ProductSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true }, // sBTC amount
  priceUSD: Number, // derived for display
  imageUrl: String,
  isActive: { type: Boolean, default: true },
  paymentCount: { type: Number, default: 0 },
  merchantAddress: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SubscriptionSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  customerId: String,
  merchantAddress: String,
  planId: String,
  amount: Number,
  amountUSD: Number,
  interval: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
  status: { type: String, enum: ['active', 'paused', 'cancelled', 'expired'], default: 'active' },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  nextPaymentDate: Date,
  metadata: Object,
  createdAt: { type: Date, default: Date.now },
  cancelledAt: Date
});

const WebhookSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  merchantId: String,
  url: String,
  events: [String],
  isActive: { type: Boolean, default: true },
  secret: String,
  createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', PaymentSchema);
const PaymentLink = mongoose.model('PaymentLink', PaymentLinkSchema);
const Subscription = mongoose.model('Subscription', SubscriptionSchema);
const Webhook = mongoose.model('Webhook', WebhookSchema);
const Product = mongoose.model('Product', ProductSchema);

// Customer Schema
const customerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  merchantAddress: { type: String, required: true },
  firstPurchaseDate: { type: Date, default: Date.now },
  totalSpent: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastPurchaseDate: { type: Date },
  notes: { type: String }
}, { timestamps: true });

customerSchema.index({ email: 1, merchantAddress: 1 }, { unique: true });
const Customer = mongoose.model('Customer', customerSchema);

const MerchantSettingsSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  merchantAddress: { type: String, index: true },
  withdrawalAddresses: { type: [String], default: [] },
  primaryAddress: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const MerchantSettings = mongoose.model('MerchantSettings', MerchantSettingsSchema);

// Ensure proper indexes and drop legacy ones
mongoose.connection.once('open', async () => {
  try {
    const indexes = await Payment.collection.indexes();
    const hasLegacy = indexes.some((i) => i.name === 'paymentId_1');
    if (hasLegacy) {
      await Payment.collection.dropIndex('paymentId_1');
      console.log('Dropped legacy index paymentId_1 on payments');
    }
    // Ensure unique index on id
    await Payment.collection.createIndex({ id: 1 }, { unique: true });
  } catch (e) {
    console.warn('Index migration warning (payments):', e.message);
  }
});

// Price Feed Service
class PriceFeedService {
  constructor() {
    this.cache = new Map();
    this.sources = {
      coingecko: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      binance: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
      coinbase: 'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
      kraken: 'https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD',
      bitstamp: 'https://www.bitstamp.net/api/v2/ticker/btcusd',
      coindesk: 'https://api.coindesk.com/v1/bpi/currentprice/BTC.json'
    };
    this.disable = (process.env.DISABLE_PRICE_FEED || 'true').toLowerCase() !== 'false';
  }

  async getBTCPrice() {
    const cacheKey = 'btc_price';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.price;
    }

    // Environment override for emergency/manual control
    const override = parseFloat(process.env.BTC_PRICE_OVERRIDE || '');
    if (!Number.isNaN(override) && override > 0) {
      this.cache.set(cacheKey, { price: override, timestamp: Date.now() });
      return override;
    }

    // If price feed is disabled, avoid any external calls
    if (this.disable) {
      const fallback = 0;
      this.cache.set(cacheKey, { price: fallback, timestamp: Date.now() });
      return fallback;
    }

    let prices = [];
    
    // Try multiple sources
    try {
      const coingecko = await axios.get(this.sources.coingecko);
      prices.push(coingecko.data.bitcoin.usd);
    } catch (e) { console.error('CoinGecko failed:', e.message); }
    
    try {
      const binance = await axios.get(this.sources.binance);
      prices.push(parseFloat(binance.data.price));
    } catch (e) { console.error('Binance failed:', e.message); }
    
    try {
      const coinbase = await axios.get(this.sources.coinbase);
      prices.push(parseFloat(coinbase.data.data.rates.USD));
    } catch (e) { console.error('Coinbase failed:', e.message); }

    try {
      const kraken = await axios.get(this.sources.kraken);
      // Kraken returns { result: { XXBTZUSD: { c: [ 'price', volume ] }}}
      const pairKey = Object.keys(kraken.data?.result || {})[0];
      const lastTrade = kraken.data?.result?.[pairKey]?.c?.[0];
      if (lastTrade) prices.push(parseFloat(lastTrade));
    } catch (e) { console.error('Kraken failed:', e.message); }

    try {
      const bitstamp = await axios.get(this.sources.bitstamp);
      if (bitstamp.data?.last) prices.push(parseFloat(bitstamp.data.last));
    } catch (e) { console.error('Bitstamp failed:', e.message); }

    try {
      const coindesk = await axios.get(this.sources.coindesk);
      const p = coindesk.data?.bpi?.USD?.rate_float;
      if (p) prices.push(parseFloat(p));
    } catch (e) { console.error('CoinDesk failed:', e.message); }
    
    if (prices.length === 0) {
      // Robust fallback closer to current market regime
      const fallback = 0;
      this.cache.set(cacheKey, { price: fallback, timestamp: Date.now() });
      return cached ? cached.price : fallback; // Sensible default if all sources fail
    }
    
    // Calculate median price
    prices.sort((a, b) => a - b);
    const medianPrice = prices[Math.floor(prices.length / 2)];
    
    this.cache.set(cacheKey, { price: medianPrice, timestamp: Date.now() });
    return medianPrice;
  }

  async convertBTCtoUSD(btcAmount) {
    const price = await this.getBTCPrice();
    if (!price || price <= 0) return 0;
    return btcAmount * price;
  }

  async convertUSDtoBTC(usdAmount) {
    const price = await this.getBTCPrice();
    if (!price || price <= 0) return 0;
    return usdAmount / price;
  }
}

const priceFeed = new PriceFeedService();

// Webhook Service
class WebhookService {
  async trigger(event, data) {
    const webhooks = await Webhook.find({ 
      events: event, 
      isActive: true,
      merchantId: data.merchantAddress 
    });
    
    for (const webhook of webhooks) {
      try {
        const payload = {
          event,
          data,
          timestamp: new Date().toISOString()
        };
        
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');
        
        await axios.post(webhook.url, payload, {
          headers: {
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event
          },
          timeout: 5000
        });
      } catch (error) {
        console.error(`Webhook failed for ${webhook.url}:`, error.message);
      }
    }
  }
}

const webhookService = new WebhookService();

// Authentication Middleware
const authenticateMerchant = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.merchantAddress = decoded.merchantAddress;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// Helper Functions
async function getContractBalance(address) {
  try {
    const functionName = 'get-sbtc-balance';
    const response = await callReadOnlyFunction({
      network,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs: [principalCV(address)],
      senderAddress: CONTRACT_ADDRESS
    });
    return cvToValue(response);
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
}

// ==================== API ENDPOINTS ====================

// Health & Configuration
app.get('/api/health', async (req, res) => {
  const btcPrice = await priceFeed.getBTCPrice();
  res.json({
    status: 'healthy',
    network: NETWORK,
    contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
    merchantAddress: MERCHANT_ADDRESS,
    btcPrice,
    timestamp: new Date().toISOString()
  });
});

// Merchant sBTC balance
app.get('/api/merchant/balance', async (req, res) => {
  try {
    const address = req.query.merchant || MERCHANT_ADDRESS;
    const balance = await getContractBalance(address);
    res.json({ address, balance });
  } catch (error) {
    console.error('Error fetching merchant balance:', error.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Load chatbot knowledge base
let chatbotKnowledge = {};
try {
  const knowledgePath = path.join(process.cwd(), 'chatbot-knowledge.json');
  chatbotKnowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
} catch (error) {
  console.warn('Could not load chatbot knowledge base:', error.message);
}

// GROQ Chatbot Service
class ChatbotService {
  constructor() {
    this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.model = 'llama-3.1-8b-instant';
    this.systemPrompt = '';
    // Initialize asynchronously to include live price
    this.refreshSystemPrompt();
  }

  async buildSystemPrompt() {
    const btcPrice = await priceFeed.getBTCPrice().catch(() => null);
    // const priceLine = btcPrice ? `- Current BTC/USD: $${btcPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}\n- sBTC price equals BTC price (1:1 peg)` : `- sBTC price equals BTC price (1:1 peg)`;
    return `You are StacksBot, the official AI assistant for StacksPay - a Bitcoin payment gateway using sBTC on the Stacks blockchain.

STRICT GUIDELINES:
- You ONLY help with Bitcoin, sBTC, Stacks blockchain, and StacksPay platform questions
- You do NOT provide general AI assistance, coding help, or non-Bitcoin/sBTC related information
- If asked about anything outside your scope, politely redirect to Bitcoin/sBTC/StacksPay topics
- Keep responses concise and practical
- Always be helpful and professional
- When users ask for specific data (revenue, payments, etc.), provide actual numbers from their account
- Never ask for or collect credentials or secrets (passwords, private keys, seed phrases, 2FA codes, dashboard logins). If data is unavailable, state what is missing and suggest how to generate it within StacksPay.
- Use the contextual merchant data included in the system prompt to answer directly. If topProduct/bottomProduct are present, report those without requesting any product IDs or logins.

YOUR KNOWLEDGE BASE:
${JSON.stringify(chatbotKnowledge, null, 2)}

PLATFORM CONTEXT:
- StacksPay enables instant Bitcoin payments via sBTC
- sBTC is Bitcoin-backed, 1:1 pegged to BTC on Stacks blockchain
- Users can create payment links, accept payments, manage customers
- Supported wallets: Leather, Xverse, Hiro Wallet
- Network: ${NETWORK}
- Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}

RESPONSE RULES:
- Focus on helping users understand Bitcoin, sBTC, and payment processes
- Provide step-by-step guidance for platform features
- Explain technical concepts in simple terms
- When providing data, always include specific amounts and date ranges
- If you don't know something specific, admit it and suggest contacting support
- Never provide financial advice or price predictions`;
  }

  async refreshSystemPrompt() {
    this.systemPrompt = await this.buildSystemPrompt();
    // Periodically refresh price in the system prompt
    setTimeout(() => this.refreshSystemPrompt(), 60_000);
  }

  async getMerchantData(query, merchantAddress) {
    try {
      // Determine date range based on query
      const now = new Date();
      let startDate, endDate, period;

      if (query.includes('last week')) {
        // Calculate last week (Monday to Sunday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6; // Handle Sunday = 0
        
        endDate = new Date(today);
        endDate.setDate(today.getDate() - daysToLastMonday);
        endDate.setHours(23, 59, 59, 999);
        
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        
        period = 'last week';
      } else if (query.includes('this week')) {
        // Calculate this week (Monday to today)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date();
        period = 'this week';
      } else if (query.includes('last month')) {
        // Calculate last month
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth;
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        period = 'last month';
      } else {
        // Default to the last 7 days if no specific period requested
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        period = 'last 7 days';
      }

      // Fetch payments data for the period
      const baseMatch = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      };
      if (merchantAddress) {
        baseMatch.merchantAddress = merchantAddress;
      }

      const payments = await Payment.find(baseMatch);

      const totalRevenue = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const totalPayments = payments.length;
      const totalRevenueUSD = payments.reduce((sum, payment) => sum + (payment.amountUSD || 0), 0);

      // Compute product performance if product metadata is available
      const byProduct = new Map();
      for (const p of payments) {
        const pid = p.metadata?.productId;
        if (!pid) continue;
        const cur = byProduct.get(pid) || { revenue: 0, payments: 0 };
        cur.revenue += p.amount || 0;
        cur.payments += 1;
        byProduct.set(pid, cur);
      }

      let topProduct = null;
      let bottomProduct = null;
      if (byProduct.size > 0) {
        // Resolve names from Product collection
        const ids = Array.from(byProduct.keys());
        const products = await Product.find({ id: { $in: ids } });
        const productMap = new Map(products.map(pr => [pr.id, pr]));
        const ranked = ids.map(id => ({ id, name: productMap.get(id)?.name || id, ...byProduct.get(id) }))
          .sort((a, b) => b.revenue - a.revenue);
        topProduct = ranked[0];
        bottomProduct = ranked[ranked.length - 1];
      }

      return {
        period,
        startDate: startDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        endDate: endDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        totalRevenue: totalRevenue.toFixed(8),
        totalRevenueUSD: totalRevenueUSD.toFixed(2),
        totalPayments,
        avgPayment: totalPayments > 0 ? (totalRevenue / totalPayments).toFixed(8) : '0.00000000',
        topProduct,
        bottomProduct
      };
    } catch (error) {
      console.error('Error fetching merchant data:', error);
      return null;
    }
  }

  async getCustomerInsights(query, merchantAddress) {
    try {
      const now = new Date();
      let startDate, endDate, period;

      if (query.includes('last week')) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
        endDate = new Date(today);
        endDate.setDate(today.getDate() - daysToLastMonday);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        period = 'last week';
      } else if (query.includes('this week')) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        period = 'this week';
      } else if (query.includes('last month')) {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth;
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        period = 'last month';
      } else {
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        period = 'last 7 days';
      }

      const matchPayments = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        'metadata.customerEmail': { $exists: true, $ne: null }
      };
      if (merchantAddress) matchPayments.merchantAddress = merchantAddress;

      const periodPayments = await Payment.find(matchPayments);
      const byEmail = new Map();
      for (const p of periodPayments) {
        const email = p.metadata?.customerEmail;
        if (!email) continue;
        const cur = byEmail.get(email) || { revenue: 0, orders: 0 };
        cur.revenue += p.amount || 0;
        cur.orders += 1;
        byEmail.set(email, cur);
      }

      let topByRevenue = null;
      let topByOrders = null;
      if (byEmail.size > 0) {
        const emails = Array.from(byEmail.keys());
        const customers = await Customer.find({ email: { $in: emails }, ...(merchantAddress ? { merchantAddress } : {}) });
        const cmap = new Map(customers.map(c => [c.email, c]));
        const rankedRevenue = emails.map(e => ({ email: e, name: cmap.get(e)?.name || e, ...byEmail.get(e) }))
          .sort((a, b) => b.revenue - a.revenue);
        const rankedOrders = emails.map(e => ({ email: e, name: cmap.get(e)?.name || e, ...byEmail.get(e) }))
          .sort((a, b) => b.orders - a.orders);
        topByRevenue = rankedRevenue[0];
        topByOrders = rankedOrders[0];
      }

      const newCustomersQuery = {
        firstPurchaseDate: { $gte: startDate, $lte: endDate }
      };
      if (merchantAddress) newCustomersQuery.merchantAddress = merchantAddress;
      const newCustomers = await Customer.countDocuments(newCustomersQuery).catch(() => 0);

      return {
        period,
        startDate: startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        endDate: endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        topCustomerByRevenue: topByRevenue,
        topCustomerByOrders: topByOrders,
        newCustomers
      };
    } catch (e) {
      console.error('Error fetching customer insights:', e);
      return null;
    }
  }

  async chat(message, opts = {}) {
    if (!GROQ_API_KEY) {
      return { error: 'Chatbot service not configured' };
    }

    try {
      let contextualData = '';
      
      // Check if user is asking for specific data
      const dataQuery = message.toLowerCase();
      const wantsData = (
        dataQuery.includes('revenue') ||
        dataQuery.includes('earnings') ||
        dataQuery.includes('sales') ||
        (dataQuery.includes('best') && dataQuery.includes('product')) ||
        dataQuery.includes('top product') ||
        dataQuery.includes('top products') ||
        dataQuery.includes('products performance') ||
        (dataQuery.includes('worst') && dataQuery.includes('product')) ||
        dataQuery.includes('least performing product') ||
        dataQuery.includes('lowest performing product') ||
        dataQuery.includes('customer') ||
        dataQuery.includes('customers') ||
        dataQuery.includes('top customer') ||
        dataQuery.includes('best customer') ||
        dataQuery.includes('top spender') ||
        dataQuery.includes('new customers')
      );

      const merchantAddress = opts.merchantAddress || MERCHANT_ADDRESS;

      if (wantsData) {
        const merchantData = await this.getMerchantData(dataQuery, merchantAddress);
        if (merchantData) {
          contextualData = `\n\nCURRENT MERCHANT DATA:\nPeriod: ${merchantData.period} (${merchantData.startDate} to ${merchantData.endDate})\nTotal Revenue: ${merchantData.totalRevenue} sBTC ($${merchantData.totalRevenueUSD} USD)\nTotal Payments: ${merchantData.totalPayments}\nAverage Payment: ${merchantData.avgPayment} sBTC\n${merchantData.topProduct ? `Top Product: ${merchantData.topProduct.name} (Revenue: ${merchantData.topProduct.revenue.toFixed(8)} sBTC, Payments: ${merchantData.topProduct.payments})` : ''}\n${merchantData.bottomProduct ? `Worst Product: ${merchantData.bottomProduct.name} (Revenue: ${merchantData.bottomProduct.revenue.toFixed(8)} sBTC, Payments: ${merchantData.bottomProduct.payments})` : ''}\n\nUse this actual data to answer the user's question with specific numbers and dates.`;
          if ((!merchantData.topProduct || merchantData.topProduct.payments === 0) && (dataQuery.includes('best') || dataQuery.includes('top') || dataQuery.includes('worst'))) {
            contextualData += `\n\nGUIDANCE: There are no product sales in this period; explicitly state that no best/worst product can be determined without asking for any IDs or credentials.`
          }
        }

        // If the query mentions customers, add customer insights context
        if (dataQuery.includes('customer')) {
          const customerData = await this.getCustomerInsights(dataQuery, merchantAddress);
          if (customerData) {
            contextualData += `\n\nCUSTOMER INSIGHTS:\nPeriod: ${customerData.period} (${customerData.startDate} to ${customerData.endDate})\n${customerData.topCustomerByRevenue ? `Top Customer by Revenue: ${customerData.topCustomerByRevenue.name} (${customerData.topCustomerByRevenue.revenue.toFixed(8)} sBTC, Orders: ${customerData.topCustomerByRevenue.orders})` : 'Top Customer by Revenue: N/A'}\n${customerData.topCustomerByOrders ? `Top Customer by Orders: ${customerData.topCustomerByOrders.name} (${customerData.topCustomerByOrders.orders} orders, ${customerData.topCustomerByOrders.revenue.toFixed(8)} sBTC)` : 'Top Customer by Orders: N/A'}\nNew Customers: ${customerData.newCustomers}`;
          }
        }
      }

      const response = await axios.post(this.apiUrl, {
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt + contextualData },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.2
      }, {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      // Sanitize outputs to ensure no credentials are requested accidentally
      let content = response.data.choices[0].message.content || '';
      const forbidden = [
        'password', 'passcode', 'seed phrase', 'seed-phrase', 'private key', 'secret key', '2fa', 'two-factor', 'login', 'credentials',
        'username', 'email address', 'account login', 'dashboard login', 'provide your login', 'provide your credentials', 'sign in',
        'product id', 'provide the product id', 'give me your product id', 'log in to your dashboard'
      ];
      const hasForbidden = forbidden.some(k => content.toLowerCase().includes(k));
      if (hasForbidden) {
        content = 'I can help using your StacksPay data directly. I will never ask for passwords, seed phrases, private keys, or logins. Please ask your question again or specify the product/time period.';
      }

      return {
        success: true,
        message: content,
        model: this.model
      };
    } catch (error) {
      console.error('GROQ API error:', error.response?.data || error.message);
      return {
        error: 'Sorry, I encountered an issue. Please try again or contact support.',
        details: error.response?.data?.error?.message || error.message
      };
    }
  }
}

const chatbotService = new ChatbotService();

// Chatbot endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, merchantAddress } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    const result = await chatbotService.chat(message.trim(), { merchantAddress });
    res.json(result);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Local echo endpoint for testing webhook delivery
app.post('/api/echo', (req, res) => {
  res.json({
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    receivedAt: new Date().toISOString()
  });
});

// Mock Webhooks: Presets
app.get('/api/mock-webhooks/presets', (req, res) => {
  const now = new Date().toISOString();
  const presets = {
    'payment.created': {
      event: 'payment.created',
      data: { id: 'pay_mock_123', amount: 0.001, currency: 'sBTC', status: 'pending', description: 'Mock payment created' },
      timestamp: now
    },
    'payment.processing': {
      event: 'payment.processing',
      data: { id: 'pay_mock_123', amount: 0.001, currency: 'sBTC', status: 'processing', txId: '0x' + 'a'.repeat(64) },
      timestamp: now
    },
    'payment.succeeded': {
      event: 'payment.succeeded',
      data: { id: 'pay_mock_123', amount: 0.001, currency: 'sBTC', status: 'confirmed', txId: '0x' + 'b'.repeat(64) },
      timestamp: now
    },
    'payment.failed': {
      event: 'payment.failed',
      data: { id: 'pay_mock_123', amount: 0.001, currency: 'sBTC', status: 'failed', reason: 'insufficient_funds' },
      timestamp: now
    }
  };
  res.json({ presets });
});

// Mock Webhooks: Send to arbitrary URL with signature
app.post('/api/mock-webhooks/send', async (req, res) => {
  try {
    const { url, event = 'payment.succeeded', payload, secret } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });

    const body = payload && payload.event ? payload : {
      event,
      data: {
        id: 'pay_mock_123',
        amount: 0.001,
        currency: 'sBTC',
        status: event.includes('failed') ? 'failed' : (event.includes('succeeded') ? 'confirmed' : 'pending')
      },
      timestamp: new Date().toISOString()
    };

    const sig = crypto.createHmac('sha256', secret || WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': body.event,
      'X-Webhook-Signature': sig
    };

    const resp = await axios.post(url, body, { headers, timeout: 7000 });
    res.json({ success: true, sentTo: url, event: body.event, signature: sig, status: resp.status, data: resp.data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send mock webhook', detail: error.response?.data || error.message });
  }
});

// Mock Webhooks: Trigger all registered webhooks for the authenticated merchant
app.post('/api/mock-webhooks/trigger-registered', authenticateMerchant, async (req, res) => {
  try {
    const { event = 'payment.succeeded' } = req.body || {};
    // Minimal mock payload that satisfies WebhookService.trigger filter (needs merchantAddress)
    const mockPayment = {
      id: 'pay_mock_123',
      amount: 0.001,
      merchantAddress: req.merchantAddress,
      status: event.includes('failed') ? 'failed' : (event.includes('succeeded') ? 'completed' : 'pending'),
      createdAt: new Date().toISOString(),
      metadata: { mock: true }
    };
    await webhookService.trigger(event, mockPayment);
    res.json({ success: true, triggered: event });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger registered webhooks', detail: error.message });
  }
});

// Widget Configuration
app.get('/api/widget/config', async (req, res) => {
  const btcPrice = await priceFeed.getBTCPrice();
  res.json({
    network: NETWORK,
    contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
    merchantAddress: req.query.merchant || MERCHANT_ADDRESS,
    btcPrice,
    theme: {
      primaryColor: '#7C3AED',
      fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: '8px'
    },
    features: {
      customAmount: true,
      email: false,
      metadata: true
    }
  });
});

// Payment creation
app.post('/api/payments/create', async (req, res) => {
  try {
    const { amount, amountUSD, metadata, paymentLinkId, merchantAddress: bodyMerchant, payoutAddress } = req.body;
    
    // Primary currency is sBTC
    let sbtcAmount;
    let usdValue;
    
    if (amount) {
      // amount is in sBTC
      sbtcAmount = amount;
      // Convert to USD for display
      usdValue = await priceFeed.convertBTCtoUSD(amount);
    } else if (amountUSD) {
      // Convert USD to sBTC
      sbtcAmount = await priceFeed.convertUSDtoBTC(amountUSD);
      usdValue = amountUSD;
    } else {
      return res.status(400).json({ error: 'Amount required' });
    }
    
    // Resolve payout/merchant address for this payment
    let resolvedMerchantAddress = bodyMerchant || payoutAddress || req.query.merchant;
    const effectivePaymentLinkId = paymentLinkId || metadata?.paymentLinkId;
    if (!resolvedMerchantAddress && effectivePaymentLinkId) {
      try {
        const pl = await PaymentLink.findOne({ id: effectivePaymentLinkId });
        if (pl?.merchantAddress) resolvedMerchantAddress = pl.merchantAddress;
      } catch (e) {
        // ignore and fallback below
      }
    }
    if (!resolvedMerchantAddress) {
      // Final fallback to env-configured merchant (legacy behavior)
      resolvedMerchantAddress = MERCHANT_ADDRESS;
    }

    const payment = new Payment({
      id: uuidv4(),
      amount: sbtcAmount, // Store in sBTC
      amountUSD: usdValue,
      merchantAddress: resolvedMerchantAddress,
      status: 'pending',
      metadata,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    
    await payment.save();
    
    // If this is a checkout payment with customer info, store customer data
    if (metadata?.customerEmail && metadata?.customerName && metadata?.checkoutType === 'product') {
      try {
        // Check if customer already exists
        const existingCustomer = await Customer.findOne({
          $or: [
            { email: metadata.customerEmail },
            { merchantAddress: resolvedMerchantAddress, email: metadata.customerEmail }
          ]
        });
        
        if (!existingCustomer) {
          // Create new customer record
          const customer = new Customer({
            id: uuidv4(),
            name: metadata.customerName,
            email: metadata.customerEmail,
            merchantAddress: resolvedMerchantAddress,
            firstPurchaseDate: new Date(),
            totalSpent: 0,
            orderCount: 0,
            status: 'active'
          });
          
          await customer.save();
          console.log('New customer created:', customer.email);
        }
      } catch (customerError) {
        console.error('Error handling customer data:', customerError);
        // Don't fail the payment if customer creation fails
      }
    }
    
    res.json({
      id: payment.id,
      amount: payment.amount, // sBTC amount
      amountUSD: payment.amountUSD,
      merchantAddress: payment.merchantAddress,
      status: payment.status,
      expiresAt: payment.expiresAt
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Products (CRUD) - sBTC primary
app.get('/api/merchant/products', authenticateMerchant, async (req, res) => {
  try {
    const products = await Product.find({ merchantAddress: req.merchantAddress }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/merchant/products', authenticateMerchant, async (req, res) => {
  try {
    const { name, description, price, imageUrl, isActive } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: 'Name and price (sBTC) are required' });
    }

    const priceUSD = await priceFeed.convertBTCtoUSD(Number(price) || 0);
    const product = new Product({
      name,
      description,
      price,
      priceUSD,
      imageUrl,
      isActive: isActive !== undefined ? isActive : true,
      merchantAddress: req.merchantAddress
    });
    await product.save();
    res.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/merchant/products/:id', authenticateMerchant, async (req, res) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    // If price changed, recompute USD
    if (updates.price != null) {
      updates.priceUSD = await priceFeed.convertBTCtoUSD(Number(updates.price) || 0);
    }

    const product = await Product.findOneAndUpdate(
      { id: req.params.id, merchantAddress: req.merchantAddress },
      updates,
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/merchant/products/:id', authenticateMerchant, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ id: req.params.id, merchantAddress: req.merchantAddress });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Product Analytics (merchant)
app.get('/api/merchant/products/:id/analytics', authenticateMerchant, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(180, Number(req.query.days || 30)));
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Ensure product belongs to merchant
    const product = await Product.findOne({ id: req.params.id, merchantAddress: req.merchantAddress });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const matchBase = { 'metadata.productId': product.id };

    const [completedAgg, attemptedCount, recentDaily, methodsAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { ...matchBase, status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' }, totalPayments: { $sum: 1 } } }
      ]),
      Payment.countDocuments(matchBase),
      Payment.aggregate([
        { $match: { ...matchBase, createdAt: { $gte: sinceDate } } },
        { $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, d: { $dayOfMonth: '$createdAt' } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
          payments: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        } },
        { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
      ]),
      Payment.aggregate([
        { $match: matchBase },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 } } }
      ])
    ]);

    const totalRevenue = completedAgg[0]?.totalRevenue || 0;
    const totalPayments = completedAgg[0]?.totalPayments || 0;
    const paymentMethods = (methodsAgg || []).reduce((acc, m) => {
      const key = m._id || 'unknown';
      acc[key] = m.count;
      return acc;
    }, {});

    const dailyData = (recentDaily || []).map((g) => {
      const date = new Date(g._id.y, g._id.m - 1, g._id.d);
      return {
        date: date.toISOString().split('T')[0],
        revenue: g.revenue || 0,
        payments: g.payments || 0,
        completed: g.completed || 0
      };
    });

    const lastNDaysRevenue = dailyData.reduce((a, b) => a + (b.revenue || 0), 0);
    const lastNDaysPayments = dailyData.reduce((a, b) => a + (b.payments || 0), 0);

    // Simple conversion approximation: completed / attempts
    const conversionRate = attemptedCount > 0 ? (totalPayments / attemptedCount) * 100 : 0;

    // Revenue growth placeholder (compute when we add previous period aggregation)
    const revenueGrowth = 0;

    res.json({
      productId: product.id,
      totalRevenue,
      totalPayments,
      avgOrderValue: product.price || 0,
      conversionRate,
      lastNDaysRevenue,
      lastNDaysPayments,
      revenueGrowth,
      dailyData,
      paymentMethods,
      topCountries: []
    });
  } catch (error) {
    console.error('Error computing product analytics:', error);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

// Payment Confirmation
app.post('/api/payments/:id/confirm', async (req, res) => {
  try {
    let { txId, customerAddress } = req.body;
    // Normalize txId (strip 0x if present for Hiro API compatibility)
    if (typeof txId === 'string' && txId.startsWith('0x')) {
      txId = txId.slice(2);
    }
    console.log(`[CONFIRM] Received payment confirmation for ${req.params.id}:`, {
      txId,
      customerAddress,
      txIdLength: txId?.length,
      txIdPrefix: txId?.substring(0, 10)
    });

    const payment = await Payment.findOne({ id: req.params.id });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    payment.status = 'pending'; // Set to pending until confirmed on-chain
    payment.txId = txId;
    payment.customerAddress = customerAddress;
    payment.completedAt = new Date();
    await payment.save();
    
    console.log(`[CONFIRM] Updated payment ${payment.id} with txId: ${txId}`);
    
    // Start async transaction monitoring
    transactionMonitor.monitorPaymentTransaction(payment.id, txId)
      .catch(error => console.error('[CONFIRM] Transaction monitoring error:', error));
    
    // Trigger webhook for initial submission
    await webhookService.trigger('payment.submitted', payment.toObject());
    
    // Update customer data if this is a checkout payment
    if (payment.metadata?.customerEmail && payment.metadata?.checkoutType === 'product') {
      try {
        await Customer.findOneAndUpdate(
          { 
            email: payment.metadata.customerEmail,
            merchantAddress: payment.merchantAddress 
          },
          { 
            $inc: { orderCount: 1 },
            $set: { lastPurchaseDate: new Date() }
          },
          { upsert: false }
        );
      } catch (customerError) {
        console.error('Error updating customer on payment confirmation:', customerError);
      }
    }
    
    res.json({ success: true, payment });
  } catch (error) {
    console.error('[CONFIRM] Payment confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Get transaction status endpoint
app.get('/api/payments/:id/transaction-status', async (req, res) => {
  try {
    const payment = await Payment.findOne({ id: req.params.id });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    if (!payment.txId) {
      return res.json({ 
        status: 'no_transaction',
        payment: payment.toObject()
      });
    }
    
    // Get current transaction status from Stacks API
    const txData = await transactionMonitor.getTransactionStatus(payment.txId);
    
    res.json({
      status: txData?.tx_status || 'unknown',
      txId: payment.txId,
      confirmedTxId: payment.confirmedTxId,
      blockHeight: txData?.block_height,
      blockHash: txData?.block_hash,
      payment: payment.toObject()
    });
  } catch (error) {
    console.error('Transaction status error:', error);
    res.status(500).json({ error: 'Failed to get transaction status' });
  }
});

// Payment Status
app.get('/api/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findOne({ id: req.params.id });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Merchant payments (paginated)
app.get('/api/merchant/payments', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const status = req.query.status;

    const query = {};
    if (status && ['pending', 'completed', 'failed', 'expired'].includes(status)) {
      query.status = status;
    }

    const [payments, total] = await Promise.all([
      Payment.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit),
      Payment.countDocuments(query)
    ]);

    // Shape data for frontend expectations
    const shaped = await Promise.all(payments.map(async (p) => ({
      _id: p._id,
      paymentId: p.id, // frontend expects paymentId
      amount: p.amount || 0, // Already in sBTC
      amountUSD: p.amountUSD || await priceFeed.convertBTCtoUSD(p.amount || 0),
      status: p.status,
      payer: p.customerAddress || null,
      txId: p.txId || null,
      createdAt: p.createdAt,
      metadata: p.metadata
    })));

    res.json({
      success: true,
      payments: shaped,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching merchant payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Payment Links
app.post('/api/payment-links', authenticateMerchant, async (req, res) => {
  try {
    const {
      name,
      description,
      amount,
      amountUSD,
      allowCustomAmount,
      minAmount,
      maxAmount,
      metadata,
      successUrl,
      cancelUrl,
      webhookUrl,
      usageLimit,
      expiresAt,
      // Optional override for payout/recipient address
      merchantAddress: requestedPayoutAddress,
      payoutAddress
    } = req.body;
    
    let finalAmount, finalAmountUSD;
    
    if (!allowCustomAmount) {
      if (amount) {
        finalAmount = amount;
        finalAmountUSD = await priceFeed.convertBTCtoUSD(amount);
      } else if (amountUSD) {
        finalAmountUSD = amountUSD;
        finalAmount = await priceFeed.convertUSDtoBTC(amountUSD);
      }
    }
    
    // Determine payout target: explicit -> primary wallet -> authenticated merchant
    let payoutTarget = requestedPayoutAddress || payoutAddress;
    if (!payoutTarget) {
      try {
        const settings = await MerchantSettings.findOne({ merchantAddress: req.merchantAddress });
        payoutTarget = settings?.primaryAddress || req.merchantAddress;
      } catch (e) {
        payoutTarget = req.merchantAddress;
      }
    }

    const paymentLink = new PaymentLink({
      name,
      description,
      amount: finalAmount,
      amountUSD: finalAmountUSD,
      merchantAddress: payoutTarget,
      allowCustomAmount,
      minAmount,
      maxAmount,
      metadata,
      successUrl,
      cancelUrl,
      webhookUrl,
      usageLimit,
      expiresAt
    });
    
    await paymentLink.save();
    
    const link = `${process.env.FRONTEND_URL}/pay/${paymentLink.id}`;
    paymentLink.paymentLink = link;
    
    res.json({
      id: paymentLink.id,
      link,
      ...paymentLink.toObject()
    });
  } catch (error) {
    console.error('Payment link creation error:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

// List merchant payment links
app.get('/api/payment-links', authenticateMerchant, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const query = { merchantAddress: req.merchantAddress };

    const [links, total] = await Promise.all([
      PaymentLink.find(query).sort({ createdAt: -1 }).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      PaymentLink.countDocuments(query)
    ]);

    const shaped = links.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      amount: l.amount,
      amountUSD: l.amountUSD,
      allowCustomAmount: l.allowCustomAmount,
      minAmount: l.minAmount,
      maxAmount: l.maxAmount,
      usageLimit: l.usageLimit,
      usageCount: l.usageCount,
      isActive: l.isActive,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      link: `${process.env.FRONTEND_URL}/pay/${l.id}`
    }));

    res.json({
      success: true,
      links: shaped,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error listing payment links:', error);
    res.status(500).json({ error: 'Failed to list payment links' });
  }
});

// Update a payment link (e.g., toggle isActive)
app.put('/api/payment-links/:id', authenticateMerchant, async (req, res) => {
  try {
    const update = { ...req.body };

    // If amount or amountUSD changes for fixed amount links, recompute the paired value
    if (update && (update.amount !== undefined || update.amountUSD !== undefined)) {
      if (update.amount !== undefined && update.amount !== null) {
        update.amountUSD = await priceFeed.convertBTCtoUSD(update.amount);
      } else if (update.amountUSD !== undefined && update.amountUSD !== null) {
        update.amount = await priceFeed.convertUSDtoBTC(update.amountUSD);
      }
    }

    const link = await PaymentLink.findOneAndUpdate(
      { id: req.params.id, merchantAddress: req.merchantAddress },
      { $set: update },
      { new: true }
    );

    if (!link) return res.status(404).json({ error: 'Payment link not found' });

    res.json({
      id: link.id,
      name: link.name,
      description: link.description,
      amount: link.amount,
      amountUSD: link.amountUSD,
      allowCustomAmount: link.allowCustomAmount,
      minAmount: link.minAmount,
      maxAmount: link.maxAmount,
      usageLimit: link.usageLimit,
      usageCount: link.usageCount,
      isActive: link.isActive,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      link: `${process.env.FRONTEND_URL}/pay/${link.id}`
    });
  } catch (error) {
    console.error('Error updating payment link:', error);
    res.status(500).json({ error: 'Failed to update payment link' });
  }
});

app.get('/api/payment-links/:id', async (req, res) => {
  try {
    const paymentLink = await PaymentLink.findOne({ id: req.params.id });
    if (!paymentLink) {
      return res.status(404).json({ error: 'Payment link not found' });
    }
    
    if (!paymentLink.isActive) {
      return res.status(400).json({ error: 'Payment link is inactive' });
    }
    
    if (paymentLink.expiresAt && new Date() > paymentLink.expiresAt) {
      return res.status(400).json({ error: 'Payment link has expired' });
    }
    
    if (paymentLink.usageLimit && paymentLink.usageCount >= paymentLink.usageLimit) {
      return res.status(400).json({ error: 'Payment link usage limit reached' });
    }
    
    res.json(paymentLink);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment link' });
  }
});

// Get product for purchase (public endpoint)
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (!product.isActive) {
      return res.status(400).json({ error: 'Product is not available for purchase' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Merchant Wallet Management
app.get('/api/merchant/wallets', authenticateMerchant, async (req, res) => {
  try {
    const doc = await MerchantSettings.findOne({ merchantAddress: req.merchantAddress });
    res.json({
      withdrawalAddresses: doc?.withdrawalAddresses || [],
      primaryAddress: doc?.primaryAddress || null
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

app.post('/api/merchant/wallets', authenticateMerchant, async (req, res) => {
  try {
    const { address, makePrimary } = req.body;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address required' });
    }

    const now = new Date();
    let doc = await MerchantSettings.findOne({ merchantAddress: req.merchantAddress });
    if (!doc) {
      doc = new MerchantSettings({ merchantAddress: req.merchantAddress, withdrawalAddresses: [], primaryAddress: null });
    }

    if (!doc.withdrawalAddresses.includes(address)) {
      doc.withdrawalAddresses.push(address);
    }
    if (makePrimary || !doc.primaryAddress) {
      doc.primaryAddress = address;
    }
    doc.updatedAt = now;
    await doc.save();

    res.json({ withdrawalAddresses: doc.withdrawalAddresses, primaryAddress: doc.primaryAddress });
  } catch (error) {
    console.error('Error adding wallet:', error);
    res.status(500).json({ error: 'Failed to add wallet' });
  }
});

app.put('/api/merchant/wallets/primary', authenticateMerchant, async (req, res) => {
  try {
    const { address } = req.body;
    let doc = await MerchantSettings.findOne({ merchantAddress: req.merchantAddress });
    if (!doc || !doc.withdrawalAddresses.includes(address)) {
      return res.status(400).json({ error: 'Address not found' });
    }
    doc.primaryAddress = address;
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ withdrawalAddresses: doc.withdrawalAddresses, primaryAddress: doc.primaryAddress });
  } catch (error) {
    console.error('Error setting primary wallet:', error);
    res.status(500).json({ error: 'Failed to set primary wallet' });
  }
});

app.delete('/api/merchant/wallets/:address', authenticateMerchant, async (req, res) => {
  try {
    const address = req.params.address;
    let doc = await MerchantSettings.findOne({ merchantAddress: req.merchantAddress });
    if (!doc) return res.json({ withdrawalAddresses: [], primaryAddress: null });
    doc.withdrawalAddresses = doc.withdrawalAddresses.filter(a => a !== address);
    if (doc.primaryAddress === address) {
      doc.primaryAddress = doc.withdrawalAddresses[0] || null;
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ withdrawalAddresses: doc.withdrawalAddresses, primaryAddress: doc.primaryAddress });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    res.status(500).json({ error: 'Failed to delete wallet' });
  }
});

// Subscription Management
// List subscriptions (merchant-scoped, paginated)
app.get('/api/subscriptions', authenticateMerchant, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const query = { merchantAddress: req.merchantAddress };
    if (status) query.status = status;

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lm = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const [items, total] = await Promise.all([
      Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip((pg - 1) * lm)
        .limit(lm),
      Subscription.countDocuments(query)
    ]);

    res.json({
      items,
      pagination: { total, page: pg, pages: Math.ceil(total / lm), limit: lm }
    });
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
});

app.post('/api/subscriptions', authenticateMerchant, async (req, res) => {
  try {
    const {
      customerId,
      planId,
      amount,
      amountUSD,
      interval,
      metadata
    } = req.body;
    
    let finalAmount, finalAmountUSD;
    
    if (amount) {
      finalAmount = amount;
      finalAmountUSD = await priceFeed.convertBTCtoUSD(amount);
    } else if (amountUSD) {
      finalAmountUSD = amountUSD;
      finalAmount = await priceFeed.convertUSDtoBTC(amountUSD);
    }
    
    const now = new Date();
    let nextPaymentDate = new Date(now);
    let periodEnd = new Date(now);
    
    switch (interval) {
      case 'daily':
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
        periodEnd.setDate(periodEnd.getDate() + 1);
        break;
      case 'weekly':
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
        periodEnd.setDate(periodEnd.getDate() + 7);
        break;
      case 'monthly':
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        break;
      case 'yearly':
        nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        break;
    }
    
    const subscription = new Subscription({
      customerId,
      merchantAddress: req.merchantAddress,
      planId,
      amount: finalAmount,
      amountUSD: finalAmountUSD,
      interval,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextPaymentDate,
      metadata
    });
    
    await subscription.save();
    
    res.json(subscription);
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

app.get('/api/subscriptions/:id', authenticateMerchant, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      id: req.params.id,
      merchantAddress: req.merchantAddress 
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

app.put('/api/subscriptions/:id/cancel', authenticateMerchant, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      id: req.params.id,
      merchantAddress: req.merchantAddress 
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();
    
    await webhookService.trigger('subscription.cancelled', subscription.toObject());
    
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Subscriptions stats (merchant-scoped)
app.get('/api/subscriptions/stats', authenticateMerchant, async (req, res) => {
  try {
    const merchantAddress = req.merchantAddress;
    const [active, cancelled] = await Promise.all([
      Subscription.countDocuments({ merchantAddress, status: 'active' }),
      Subscription.countDocuments({ merchantAddress, status: 'cancelled' })
    ]);

    const revenueAgg = await Subscription.aggregate([
      { $match: { merchantAddress, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const revenue = revenueAgg?.[0]?.total || 0;

    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const nextPayouts = await Subscription.countDocuments({
      merchantAddress,
      status: 'active',
      nextPaymentDate: { $gte: now, $lte: in30 }
    });

    res.json({ active, cancelled, revenue, nextPayouts });
  } catch (error) {
    console.error('Subscriptions stats error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription stats' });
  }
});


// Merchant Statistics
app.get('/api/merchant/stats', async (req, res) => {
  try {
    const merchantAddress = req.query.merchant || MERCHANT_ADDRESS;
    
    // Get on-chain balance
    const balance = await getContractBalance(merchantAddress);
    const btcPrice = await priceFeed.getBTCPrice();
    
    // Get payment statistics
    const totalPayments = await Payment.countDocuments({ 
      merchantAddress,
      status: 'completed' 
    });
    
    const volumeResult = await Payment.aggregate([
      { $match: { merchantAddress, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalVolume = volumeResult[0]?.total || 0;
    
    // Get recent payments
    const recentPayments = await Payment.find({ merchantAddress })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get active subscriptions
    const activeSubscriptions = await Subscription.countDocuments({
      merchantAddress,
      status: 'active'
    });
    
    res.json({
      merchantBalance: balance,
      merchantBalanceUSD: (balance / 1000000) * btcPrice,
      totalVolume,
      totalVolumeUSD: (totalVolume / 1000000) * btcPrice,
      totalPayments,
      completedPayments: totalPayments,
      activeSubscriptions,
      recentPayments,
      btcPrice
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Webhook Management
app.post('/api/webhooks', authenticateMerchant, async (req, res) => {
  try {
    const { url, events } = req.body;
    
    const webhook = new Webhook({
      merchantId: req.merchantAddress,
      url,
      events,
      secret: crypto.randomBytes(32).toString('hex')
    });
    
    await webhook.save();
    
    res.json(webhook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { merchantAddress } = req.body;
    
    if (!merchantAddress) {
      return res.status(400).json({ error: 'Merchant address required' });
    }
    
    const token = jwt.sign(
      { merchantAddress },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, merchantAddress });
  } catch (error) {
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

// Start Server
// Only start a local HTTP server when not running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Enhanced sBTC Payment Gateway API running on port ${PORT}`);
    console.log(`Network: ${NETWORK}`);
    console.log(`Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
    console.log(`Merchant: ${MERCHANT_ADDRESS}`);
  });
}

export default app;
