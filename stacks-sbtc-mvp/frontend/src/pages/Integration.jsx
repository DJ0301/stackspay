import React, { useState } from 'react'
import { Code2, Copy, Check, Package, Globe, Terminal } from 'lucide-react'
import { toast } from 'react-toastify'

function Integration() {
  const [copiedId, setCopiedId] = useState(null)
  const [activeTab, setActiveTab] = useState('widget')

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const widgetCode = `<!-- sBTC Payment Widget -->
<div id="sbtc-payment-widget"></div>
<script src="https://your-domain.com/widget.js"></script>
<script>
  SBTCPayment.init({
    amount: 1000000, // in micro-sBTC
    metadata: {
      orderId: '12345',
      customerEmail: 'customer@example.com'
    },
    onSuccess: function(data) {
      console.log('Payment successful:', data);
      // Handle success
    },
    onError: function(error) {
      console.error('Payment failed:', error);
      // Handle error
    }
  });
</script>`

  const npmInstall = `npm install @sbtc-pay/sdk`

  const jsExample = `import { SBTCPayment } from '@sbtc-pay/sdk';

// Initialize the SDK
const payment = new SBTCPayment({
  apiKey: 'your-api-key',
  network: 'testnet'
});

// Create a payment
const paymentData = await payment.create({
  amount: 1000000, // in micro-sBTC
  amountUSD: 10.50, // or specify in USD
  metadata: {
    orderId: '12345',
    customerEmail: 'customer@example.com'
  }
});

// Generate payment link
const paymentLink = payment.getPaymentLink(paymentData.paymentId);
console.log('Payment link:', paymentLink);`

  const apiExample = `// Create a payment
fetch('https://api.sbtc-pay.com/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    amount: 1000000,
    metadata: {
      orderId: '12345'
    }
  })
})
.then(res => res.json())
.then(data => {
  console.log('Payment created:', data);
  // Redirect to payment link
  window.location.href = data.paymentLink;
});

// Check payment status
fetch('https://api.sbtc-pay.com/api/payments/{paymentId}')
  .then(res => res.json())
  .then(data => {
    console.log('Payment status:', data.payment.status);
  });`

  const webhookExample = `// Express.js webhook endpoint
app.post('/webhook/sbtc-payment', (req, res) => {
  const { event, payment } = req.body;
  
  switch(event) {
    case 'payment.completed':
      // Handle successful payment
      console.log('Payment completed:', payment.paymentId);
      // Update order status, send confirmation email, etc.
      break;
      
    case 'payment.failed':
      // Handle failed payment
      console.log('Payment failed:', payment.paymentId);
      break;
  }
  
  res.status(200).send('OK');
});`

  const tabs = [
    { id: 'widget', label: 'Embed Widget', icon: Package },
    { id: 'sdk', label: 'JavaScript SDK', icon: Code2 },
    { id: 'api', label: 'REST API', icon: Globe },
    { id: 'webhook', label: 'Webhooks', icon: Terminal }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Integration</h1>
        <p className="text-white/70 mt-2">Integrate sBTC payments into your application</p>
      </div>

      {/* Quick Start */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="text-primary-600 font-semibold mb-2">1. Get API Key</div>
            <p className="text-sm text-gray-600">Generate your API key from Settings</p>
          </div>
          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="text-primary-600 font-semibold mb-2">2. Install SDK</div>
            <p className="text-sm text-gray-600">Install our SDK or use the widget</p>
          </div>
          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="text-primary-600 font-semibold mb-2">3. Start Accepting</div>
            <p className="text-sm text-gray-600">Start accepting sBTC payments</p>
          </div>
        </div>
      </div>

      {/* Integration Methods */}
      <div className="card">
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Widget Tab */}
        {activeTab === 'widget' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Embed Payment Widget</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add this code to your HTML to embed the payment widget on your website.
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{widgetCode}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(widgetCode, 'widget')}
                  className="absolute top-2 right-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  {copiedId === 'widget' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SDK Tab */}
        {activeTab === 'sdk' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Install SDK</h3>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{npmInstall}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(npmInstall, 'npm')}
                  className="absolute top-2 right-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  {copiedId === 'npm' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Usage Example</h3>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{jsExample}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(jsExample, 'js')}
                  className="absolute top-2 right-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  {copiedId === 'js' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Tab */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">REST API Example</h3>
              <p className="text-sm text-gray-600 mb-4">
                Use our REST API to create and manage payments programmatically.
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{apiExample}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(apiExample, 'api')}
                  className="absolute top-2 right-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  {copiedId === 'api' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Webhook Tab */}
        {activeTab === 'webhook' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Webhook Integration</h3>
              <p className="text-sm text-gray-600 mb-4">
                Receive real-time notifications when payment events occur.
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{webhookExample}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(webhookExample, 'webhook')}
                  className="absolute top-2 right-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  {copiedId === 'webhook' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Endpoints */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Endpoints</h2>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">POST</span>
            <div>
              <code className="text-sm font-mono">/api/payments/create</code>
              <p className="text-sm text-gray-600 mt-1">Create a new payment</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">GET</span>
            <div>
              <code className="text-sm font-mono">/api/payments/:paymentId</code>
              <p className="text-sm text-gray-600 mt-1">Get payment status</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">POST</span>
            <div>
              <code className="text-sm font-mono">/api/payments/:paymentId/confirm</code>
              <p className="text-sm text-gray-600 mt-1">Confirm payment completion</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">GET</span>
            <div>
              <code className="text-sm font-mono">/api/merchant/payments</code>
              <p className="text-sm text-gray-600 mt-1">List all payments</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">GET</span>
            <div>
              <code className="text-sm font-mono">/api/merchant/stats</code>
              <p className="text-sm text-gray-600 mt-1">Get merchant statistics</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Integration
