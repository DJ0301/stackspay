import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sbtc-payment-gateway';
await mongoose.connect(MONGODB_URI);

// Define schemas (same as in server.js)
const PaymentSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  amount: Number,
  amountUSD: Number,
  status: { type: String, enum: ['pending', 'completed', 'failed', 'expired'], default: 'pending' },
  merchantAddress: String,
  customerAddress: String,
  payer: String,
  txId: String,
  confirmedTxId: String,
  metadata: Object,
  expiresAt: Date,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: uuidv4 },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  imageUrl: String,
  isActive: { type: Boolean, default: true },
  paymentCount: { type: Number, default: 0 },
  merchantAddress: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

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

const Payment = mongoose.model('Payment', PaymentSchema);
const Product = mongoose.model('Product', ProductSchema);
const Customer = mongoose.model('Customer', customerSchema);

const MERCHANT_ADDRESS = 'ST3P5115329Z40SSHC2KXFN89T5R5QRJGCJCP4RQP';

// Mock data generators
const firstNames = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
  'Kate', 'Liam', 'Maya', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Ruby', 'Sam', 'Tara',
  'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zoe', 'Alex', 'Blake', 'Casey', 'Drew',
  'Emma', 'Felix', 'Gina', 'Hugo', 'Iris', 'Jake', 'Kira', 'Leo', 'Mia', 'Nico',
  'Oscar', 'Piper', 'Quincy', 'Rosa', 'Seth', 'Tina', 'Uri', 'Vera', 'Will', 'Xara'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'protonmail.com', 'icloud.com'];

const productNames = [
  'Premium Subscription', 'Pro Plan', 'Enterprise License', 'Digital Course', 'E-book Bundle',
  'Video Tutorial Series', 'Software License', 'API Access', 'Cloud Storage', 'VPN Service',
  'Design Templates', 'Stock Photos', 'Music License', 'Font Collection', 'Icon Pack',
  'WordPress Theme', 'Mobile App', 'Web Hosting', 'Domain Registration', 'SSL Certificate',
  'Analytics Tool', 'Marketing Suite', 'CRM Access', 'Project Management', 'Team Collaboration',
  'File Converter', 'Password Manager', 'Backup Service', 'Security Audit', 'Performance Monitor',
  'SEO Tools', 'Social Media Manager', 'Email Marketing', 'Landing Page Builder', 'Form Builder',
  'Survey Tool', 'Live Chat', 'Help Desk', 'Knowledge Base', 'Documentation Tool',
  'Code Editor', 'IDE License', 'Database Tool', 'API Testing', 'Monitoring Service',
  'CI/CD Pipeline', 'Container Registry', 'Serverless Functions', 'Edge Computing', 'CDN Service'
];

const productDescriptions = [
  'Access to premium features and priority support',
  'Professional tools for growing businesses',
  'Enterprise-grade solution with advanced features',
  'Comprehensive learning material with lifetime access',
  'Complete collection of digital resources',
  'Step-by-step video tutorials by experts',
  'Full commercial license for software use',
  'Unlimited API calls with premium endpoints',
  'Secure cloud storage with encryption',
  'Fast and secure VPN with global servers',
  'Professional design templates for all needs',
  'High-quality stock photography collection',
  'Royalty-free music for commercial use',
  'Premium font collection for designers',
  'Scalable vector icons for web and mobile',
  'Responsive WordPress theme with customization',
  'Native mobile application with full features',
  'Reliable web hosting with 99.9% uptime',
  'Premium domain with free privacy protection',
  'Extended validation SSL certificate',
  'Advanced analytics and reporting tools',
  'Complete marketing automation suite',
  'Customer relationship management system',
  'Collaborative project management platform',
  'Team communication and file sharing',
  'Multi-format file conversion tool',
  'Secure password management solution',
  'Automated backup and recovery service',
  'Comprehensive security vulnerability assessment',
  'Real-time performance monitoring dashboard'
];

const walletAddresses = [
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
  'ST2JHG361ZXG51QTQAVC8XHQMH8XBVQGM8QHQKXHX',
  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB',
  'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0',
  'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ',
  'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP',
  'ST1R1061ZT6KPJXQ7PAXPFB6ZAZ6ZWW28G8HXK9G5',
  'ST2TFVBMRPS5SSNP98DQKQ5JNB2B6NZM91C4K3P2B',
  'ST3CECXJ8RQVJR7DQXW6QDQXQXQXQXQXQXQXQXQX'
];

// Generate random date within range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate random amount with realistic distribution
function randomAmount() {
  const rand = Math.random();
  if (rand < 0.4) return (Math.random() * 0.001 + 0.0001); // Small amounts (0.0001-0.0011 sBTC)
  if (rand < 0.7) return (Math.random() * 0.01 + 0.001); // Medium amounts (0.001-0.011 sBTC)
  if (rand < 0.9) return (Math.random() * 0.1 + 0.01); // Large amounts (0.01-0.11 sBTC)
  return (Math.random() * 1 + 0.1); // Very large amounts (0.1-1.1 sBTC)
}

// Generate transaction ID
function generateTxId() {
  return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function generateMockData() {
  console.log('🧹 Clearing existing data...');
  await Payment.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});

  console.log('📦 Generating products...');
  const products = [];
  for (let i = 0; i < 50; i++) {
    const product = {
      id: uuidv4(),
      name: productNames[i % productNames.length],
      description: productDescriptions[i % productDescriptions.length],
      price: randomAmount(),
      imageUrl: `https://picsum.photos/400/300?random=${i}`,
      isActive: Math.random() > 0.1, // 90% active
      paymentCount: 0,
      merchantAddress: MERCHANT_ADDRESS,
      createdAt: randomDate(new Date('2023-01-01'), new Date('2024-12-01'))
    };
    products.push(product);
  }
  await Product.insertMany(products);

  console.log('👥 Generating customers...');
  const customers = [];
  const customerEmails = new Set();
  
  for (let i = 0; i < 200; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    
    let email;
    do {
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@${domain}`;
    } while (customerEmails.has(email));
    customerEmails.add(email);

    const firstPurchase = randomDate(new Date('2023-01-01'), new Date());
    const customer = {
      id: uuidv4(),
      name: `${firstName} ${lastName}`,
      email: email,
      merchantAddress: MERCHANT_ADDRESS,
      firstPurchaseDate: firstPurchase,
      totalSpent: 0,
      orderCount: 0,
      status: 'active',
      lastPurchaseDate: firstPurchase
    };
    customers.push(customer);
  }
  await Customer.insertMany(customers);

  console.log('💳 Generating transactions...');
  const payments = [];
  const customerList = await Customer.find({});
  const productList = await Product.find({});
  
  // Generate 2000+ transactions over the past 2 years
  for (let i = 0; i < 2500; i++) {
    const customer = customerList[Math.floor(Math.random() * customerList.length)];
    const product = productList[Math.floor(Math.random() * productList.length)];
    const amount = product.price + (Math.random() - 0.5) * product.price * 0.1; // ±10% variation
    const createdAt = randomDate(new Date('2023-01-01'), new Date());
    
    // 85% completed, 10% failed, 5% pending/expired
    let status = 'completed';
    const statusRand = Math.random();
    if (statusRand > 0.95) status = 'pending';
    else if (statusRand > 0.85) status = 'failed';
    
    const payment = {
      id: uuidv4(),
      amount: amount,
      amountUSD: amount * (45000 + Math.random() * 20000), // BTC price variation
      status: status,
      merchantAddress: MERCHANT_ADDRESS,
      customerAddress: walletAddresses[Math.floor(Math.random() * walletAddresses.length)],
      payer: walletAddresses[Math.floor(Math.random() * walletAddresses.length)],
      txId: status === 'completed' ? generateTxId() : null,
      confirmedTxId: status === 'completed' ? generateTxId() : null,
      metadata: {
        productId: product.id,
        productName: product.name,
        customerEmail: customer.email,
        customerName: customer.name,
        checkoutType: 'product'
      },
      expiresAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
      completedAt: status === 'completed' ? new Date(createdAt.getTime() + Math.random() * 30 * 60 * 1000) : null,
      createdAt: createdAt
    };
    payments.push(payment);
  }
  
  // Sort by creation date for realistic progression
  payments.sort((a, b) => a.createdAt - b.createdAt);
  await Payment.insertMany(payments);

  console.log('🔄 Updating customer and product statistics...');
  
  // Update customer statistics
  for (const customer of customerList) {
    const customerPayments = payments.filter(p => 
      p.metadata?.customerEmail === customer.email && p.status === 'completed'
    );
    
    if (customerPayments.length > 0) {
      const totalSpent = customerPayments.reduce((sum, p) => sum + p.amount, 0);
      const lastPayment = customerPayments.reduce((latest, p) => 
        p.createdAt > latest.createdAt ? p : latest
      );
      
      await Customer.findByIdAndUpdate(customer._id, {
        totalSpent: totalSpent,
        orderCount: customerPayments.length,
        lastPurchaseDate: lastPayment.createdAt,
        status: (Date.now() - lastPayment.createdAt.getTime()) > (90 * 24 * 60 * 60 * 1000) ? 'inactive' : 'active'
      });
    }
  }

  // Update product statistics
  for (const product of productList) {
    const productPayments = payments.filter(p => 
      p.metadata?.productId === product.id && p.status === 'completed'
    );
    
    await Product.findByIdAndUpdate(product._id, {
      paymentCount: productPayments.length
    });
  }

  // Generate some subscription-style recurring payments
  console.log('🔄 Generating recurring payments...');
  const recurringCustomers = customerList.slice(0, 50); // First 50 customers have subscriptions
  const subscriptionProducts = productList.filter(p => 
    p.name.includes('Subscription') || p.name.includes('Plan') || p.name.includes('Service')
  );

  for (const customer of recurringCustomers) {
    const product = subscriptionProducts[Math.floor(Math.random() * subscriptionProducts.length)];
    const startDate = randomDate(new Date('2023-06-01'), new Date('2024-08-01'));
    
    // Generate monthly payments for 3-12 months
    const months = Math.floor(Math.random() * 10) + 3;
    for (let month = 0; month < months; month++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + month);
      
      if (paymentDate > new Date()) break; // Don't create future payments
      
      const recurringPayment = {
        id: uuidv4(),
        amount: product.price,
        amountUSD: product.price * (45000 + Math.random() * 20000),
        status: Math.random() > 0.05 ? 'completed' : 'failed', // 95% success rate for subscriptions
        merchantAddress: MERCHANT_ADDRESS,
        customerAddress: walletAddresses[Math.floor(Math.random() * walletAddresses.length)],
        payer: walletAddresses[Math.floor(Math.random() * walletAddresses.length)],
        txId: generateTxId(),
        confirmedTxId: generateTxId(),
        metadata: {
          productId: product.id,
          productName: product.name,
          customerEmail: customer.email,
          customerName: customer.name,
          checkoutType: 'subscription',
          subscriptionPeriod: 'monthly'
        },
        expiresAt: new Date(paymentDate.getTime() + 60 * 60 * 1000),
        completedAt: new Date(paymentDate.getTime() + Math.random() * 10 * 60 * 1000),
        createdAt: paymentDate
      };
      
      await Payment.create(recurringPayment);
    }
  }

  // Final statistics update
  console.log('📊 Final statistics update...');
  const finalStats = await Promise.all([
    Payment.countDocuments(),
    Product.countDocuments(),
    Customer.countDocuments(),
    Payment.countDocuments({ status: 'completed' }),
    Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  console.log('\n🎉 Mock data generation complete!');
  console.log('📈 Statistics:');
  console.log(`   💳 Total Payments: ${finalStats[0]}`);
  console.log(`   📦 Total Products: ${finalStats[1]}`);
  console.log(`   👥 Total Customers: ${finalStats[2]}`);
  console.log(`   ✅ Completed Payments: ${finalStats[3]}`);
  console.log(`   💰 Total Revenue: ${finalStats[4][0]?.total?.toFixed(8) || 0} sBTC`);
  console.log(`   📅 Date Range: 2023-01-01 to ${new Date().toISOString().split('T')[0]}`);
  
  await mongoose.disconnect();
}

generateMockData().catch(console.error);
