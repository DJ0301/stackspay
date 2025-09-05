const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Use the PaymentLink model from the main server
const PaymentLinkSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  shortCode: { type: String, unique: true },
  name: String,
  description: String,
  amount: Number,
  amountUSD: Number,
  allowCustomAmount: { type: Boolean, default: false },
  minAmount: Number,
  maxAmount: Number,
  successUrl: String,
  cancelUrl: String,
  webhookUrl: String,
  metadata: Object,
  usageLimit: Number,
  usageCount: { type: Number, default: 0 },
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  merchantId: String,
  link: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const PaymentLink = mongoose.models.PaymentLink || mongoose.model('PaymentLink', PaymentLinkSchema);

// Middleware to verify merchant JWT
const verifyMerchant = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.merchantId = decoded.merchantId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }
};

// Create payment link
router.post('/payment-links', verifyMerchant, async (req, res) => {
  try {
    const {
      name,
      description,
      amount,
      amountUSD,
      allowCustomAmount,
      minAmount,
      maxAmount,
      successUrl,
      cancelUrl,
      webhookUrl,
      metadata,
      usageLimit,
      expiresAt
    } = req.body;

    const linkId = `link_${uuidv4()}`;
    const shortCode = Math.random().toString(36).substring(2, 10);

    const paymentLinkData = {
      id: linkId,
      shortCode,
      name,
      description,
      amount,
      amountUSD,
      allowCustomAmount: allowCustomAmount || false,
      minAmount,
      maxAmount,
      successUrl,
      cancelUrl,
      webhookUrl,
      metadata: metadata || {},
      usageLimit: usageLimit || null,
      usageCount: 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      merchantId: req.merchantId,
      link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pay/${shortCode}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store in MongoDB
    const paymentLink = new PaymentLink(paymentLinkData);
    await paymentLink.save();

    res.json(paymentLink);
  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

// Get all payment links for merchant
router.get('/payment-links', verifyMerchant, async (req, res) => {
  try {
    const merchantLinks = await PaymentLink.find({ merchantId: req.merchantId })
      .sort({ createdAt: -1 });

    res.json(merchantLinks);
  } catch (error) {
    console.error('Error fetching payment links:', error);
    res.status(500).json({ error: 'Failed to fetch payment links' });
  }
});

// Get single payment link
router.get('/payment-links/:id', verifyMerchant, async (req, res) => {
  try {
    const link = await PaymentLink.findOne({ 
      id: req.params.id, 
      merchantId: req.merchantId 
    });
    
    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    res.json(link);
  } catch (error) {
    console.error('Error fetching payment link:', error);
    res.status(500).json({ error: 'Failed to fetch payment link' });
  }
});

// Update payment link
router.put('/payment-links/:id', verifyMerchant, async (req, res) => {
  try {
    const updatedLink = await PaymentLink.findOneAndUpdate(
      { id: req.params.id, merchantId: req.merchantId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!updatedLink) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    res.json(updatedLink);
  } catch (error) {
    console.error('Error updating payment link:', error);
    res.status(500).json({ error: 'Failed to update payment link' });
  }
});

// Delete payment link
router.delete('/payment-links/:id', verifyMerchant, async (req, res) => {
  try {
    const deletedLink = await PaymentLink.findOneAndDelete({ 
      id: req.params.id, 
      merchantId: req.merchantId 
    });
    
    if (!deletedLink) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    res.json({ success: true, message: 'Payment link deleted' });
  } catch (error) {
    console.error('Error deleting payment link:', error);
    res.status(500).json({ error: 'Failed to delete payment link' });
  }
});

// Get payment link by short code (public endpoint)
router.get('/pay/:shortCode', async (req, res) => {
  try {
    const link = await PaymentLink.findOne({ shortCode: req.params.shortCode });
    
    if (!link || !link.isActive) {
      return res.status(404).json({ error: 'Payment link not found or inactive' });
    }

    // Check if link is expired
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({ error: 'Payment link has expired' });
    }

    // Check usage limit
    if (link.usageLimit && link.usageCount >= link.usageLimit) {
      return res.status(410).json({ error: 'Payment link usage limit reached' });
    }

    // Return public data only
    res.json({
      name: link.name,
      description: link.description,
      amount: link.amount,
      amountUSD: link.amountUSD,
      allowCustomAmount: link.allowCustomAmount,
      minAmount: link.minAmount,
      maxAmount: link.maxAmount,
      metadata: link.metadata,
      merchantId: link.merchantId
    });
  } catch (error) {
    console.error('Error fetching payment link:', error);
    res.status(500).json({ error: 'Failed to fetch payment link' });
  }
});

// Process payment through link
router.post('/pay/:shortCode/process', async (req, res) => {
  try {
    const { amount, customerEmail, customerAddress, txId } = req.body;
    
    const link = await PaymentLink.findOne({ shortCode: req.params.shortCode });
    
    if (!link || !link.isActive) {
      return res.status(404).json({ error: 'Payment link not found or inactive' });
    }

    // Validate amount if custom amount is allowed
    if (link.allowCustomAmount) {
      if (link.minAmount && amount < link.minAmount) {
        return res.status(400).json({ error: `Amount must be at least ${link.minAmount}` });
      }
      if (link.maxAmount && amount > link.maxAmount) {
        return res.status(400).json({ error: `Amount must not exceed ${link.maxAmount}` });
      }
    }

    // Increment usage count
    await PaymentLink.findByIdAndUpdate(link._id, { 
      $inc: { usageCount: 1 } 
    });

    // Create payment record
    const payment = {
      id: uuidv4(),
      linkId: link.id,
      amount: amount || link.amount,
      amountUSD: link.amountUSD,
      customerEmail,
      customerAddress,
      txId,
      status: 'completed',
      createdAt: new Date()
    };

    // Trigger webhook if configured
    if (link.webhookUrl) {
      // Async webhook call (don't await)
      triggerWebhook(link.webhookUrl, payment);
    }

    res.json({
      success: true,
      payment,
      redirectUrl: link.successUrl || null
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Helper function to trigger webhooks
async function triggerWebhook(url, data) {
  try {
    const axios = require('axios');
    await axios.post(url, {
      event: 'payment.completed',
      data,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': generateWebhookSignature(data)
      },
      timeout: 5000
    });
  } catch (error) {
    console.error('Webhook failed:', error.message);
  }
}

// Helper function to generate webhook signature
function generateWebhookSignature(data) {
  const crypto = require('crypto');
  const secret = process.env.WEBHOOK_SECRET || 'webhook-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
}

module.exports = router;
