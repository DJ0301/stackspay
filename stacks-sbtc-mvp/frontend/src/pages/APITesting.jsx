import React, { useState, useEffect } from 'react'
import { Play, Check, X, Copy, Zap, Globe, Database, Webhook } from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-toastify'

function APITesting() {
  const [testResults, setTestResults] = useState({})
  const [loading, setLoading] = useState({})
  const [webhookUrl, setWebhookUrl] = useState(() => (typeof window !== 'undefined' ? `${window.location.origin}/api/echo` : '/api/echo'))
  const [testPaymentId, setTestPaymentId] = useState('')
  const [testInputs, setTestInputs] = useState({
    'create-payment': {
      amount: '0.001',
      description: 'Test Payment from API Testing',
      metadata: '{}'
    },
    'webhook-test': {
      payload: ''
    }
  })
  const [demoSteps, setDemoSteps] = useState([])
  const [currentDemoStep, setCurrentDemoStep] = useState(0)
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoPayment, setDemoPayment] = useState(null)
  const [showDemoWidget, setShowDemoWidget] = useState(false)
  const [webhookEventType, setWebhookEventType] = useState('payment.succeeded')
  const [webhookSecret, setWebhookSecret] = useState('')

  // Fixed mock webhook payloads
  const mockWebhookPayloads = {
    'payment.created': {
      event: 'payment.created',
      data: {
        id: 'pay_mock_123',
        amount: 0.001,
        currency: 'sBTC',
        status: 'pending',
        description: 'Mock payment created'
      },
      createdAt: new Date().toISOString()
    },
    'payment.processing': {
      event: 'payment.processing',
      data: {
        id: 'pay_mock_123',
        amount: 0.001,
        currency: 'sBTC',
        status: 'processing',
        txId: '0x' + 'a'.repeat(64)
      },
      createdAt: new Date().toISOString()
    },
    'payment.succeeded': {
      event: 'payment.succeeded',
      data: {
        id: 'pay_mock_123',
        amount: 0.001,
        currency: 'sBTC',
        status: 'confirmed',
        txId: '0x' + 'b'.repeat(64)
      },
      createdAt: new Date().toISOString()
    },
    'payment.failed': {
      event: 'payment.failed',
      data: {
        id: 'pay_mock_123',
        amount: 0.001,
        currency: 'sBTC',
        status: 'failed',
        reason: 'insufficient_funds'
      },
      createdAt: new Date().toISOString()
    }
  }

  // Initialize and update webhook payload from fixed presets
  useEffect(() => {
    setTestInputs(prev => ({
      ...prev,
      'webhook-test': {
        payload: JSON.stringify(mockWebhookPayloads[webhookEventType], null, 2)
      }
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhookEventType])

  // Compute HMAC SHA-256 hex using Web Crypto API
  const hmacSHA256Hex = async (message, secret) => {
    const enc = new TextEncoder()
    const key = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(message))
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const apiTests = [
    { id: 'health', name: 'Health Check', description: 'Test API health', endpoint: '/api/health', method: 'GET' },
    { id: 'webhook-test', name: 'Webhook Test', description: 'Send a mock event to your webhook URL', endpoint: '[custom URL]', method: 'POST', hasInputs: true },
    { id: 'create-payment', name: 'Create Payment', description: 'Test payment creation', endpoint: '/api/payments/create', method: 'POST', hasInputs: true }
  ]

  const updateTestInput = (testId, field, value) => {
    setTestInputs(prev => ({
      ...prev,
      [testId]: { ...prev[testId], [field]: value }
    }))
  }

  const runTest = async (test) => {
    setLoading(prev => ({ ...prev, [test.id]: true }))
    
    try {
      const config = { method: test.method, url: test.endpoint, timeout: 10000 }

      if (test.hasInputs && test.id === 'create-payment') {
        const inputs = testInputs[test.id]
        config.data = {
          amount: parseFloat(inputs.amount),
          description: inputs.description,
          metadata: JSON.parse(inputs.metadata || '{}')
        }
      } else if (test.id === 'webhook-test') {
        const inputs = testInputs['webhook-test']
        let body
        try {
          body = JSON.parse(inputs.payload || '{}')
        } catch (e) {
          throw new Error('Invalid JSON in webhook payload')
        }
        config.method = 'POST'
        config.url = '/api/mock-webhooks/send'
        config.data = {
          url: webhookUrl,
          event: webhookEventType,
          payload: body,
          secret: webhookSecret || undefined
        }
      }

      const response = await axios(config)
      
      setTestResults(prev => ({
        ...prev,
        [test.id]: {
          status: 'success',
          data: response.data,
          statusCode: response.status,
          timestamp: new Date().toISOString()
        }
      }))

      if (test.id === 'create-payment' && response.data?.id) {
        setTestPaymentId(response.data.id)
        // Store payment data for link display
        setTestResults(prev => ({
          ...prev,
          [test.id]: {
            ...prev[test.id],
            paymentLink: `${window.location.origin}/pay/${response.data.id}`
          }
        }))
      }

      toast.success(`${test.name} test passed`)
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [test.id]: {
          status: 'error',
          error: error.response?.data || error.message,
          statusCode: error.response?.status,
          timestamp: new Date().toISOString()
        }
      }))
      toast.error(`${test.name} test failed`)
    } finally {
      setLoading(prev => ({ ...prev, [test.id]: false }))
    }
  }

  const runAllTests = async () => {
    for (const test of apiTests) {
      await runTest(test)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  const simulatePaymentFlow = async (type) => {
    const loadingKey = type === 'widget' ? 'simulateWidget' : 'simulateLink'
    setLoading(prev => ({ ...prev, [loadingKey]: true }))
    setDemoRunning(true)
    setCurrentDemoStep(0)

    const steps = type === 'widget' ? [
      { name: 'Initializing widget...', code: 'const widget = new PaymentWidget({ amount: 0.001 })', delay: 2000 },
      { name: 'Creating payment...', code: 'POST /api/payments/create { amount, description }', delay: 1500 },
      { name: 'Rendering payment UI...', code: 'widget.render(); showPaymentForm(payment)', delay: 3000 },
      { name: 'Broadcasting transaction...', code: 'await provider.request("stx_callContract", options)', delay: 2000 },
      { name: 'Confirming payment...', code: 'POST /api/payments/:id/confirm { txId }', delay: 1500 },
      { name: 'Payment complete!', code: 'setStatus("success"); onSuccess({ txId })', delay: 1000 }
    ] : [
      { name: 'Creating payment link...', code: 'POST /api/payment-links { amount, description }', delay: 1500 },
      { name: 'Generating link...', code: 'const url = `${origin}/pay/${linkId}`', delay: 1000 },
      { name: 'Link ready to share', code: 'display(url); copy(url)', delay: 1000 }
    ]

    setDemoSteps(steps)

    try {
      let paymentId, paymentData, linkId, paymentLinkUrl
      
      for (let i = 0; i < steps.length; i++) {
        setCurrentDemoStep(i)

        if (type === 'widget') {
          if (i === 1) {
            const createResponse = await axios.post('/api/payments/create', {
              amount: 0.001,
              description: '🎮 Widget Demo Payment',
              metadata: { testType: 'widget_simulation', demo: true }
            })
            paymentId = createResponse.data.id
            paymentData = createResponse.data
            setDemoPayment(createResponse.data)
          } else if (i === 2) {
            setShowDemoWidget(true)
          } else if (i === 4) {
            await axios.post(`/api/payments/${paymentId}/confirm`, {
              txId: '0x' + Math.random().toString(16).substring(2, 50),
              customerAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
            })
          }
        } else if (type === 'link') {
          if (i === 0) {
            // Try real API if authed; otherwise mock
            const token = localStorage.getItem('merchantToken')
            if (token) {
              const linkResp = await axios.post('/api/payment-links', {
                amount: 0.002,
                description: '🔗 Demo Payment Link',
                allowCustomAmount: false
              }, { headers: { Authorization: `Bearer ${token}` } })
              linkId = linkResp.data.id
            } else {
              linkId = 'mock-' + Math.random().toString(36).slice(2, 8)
            }
            paymentLinkUrl = `${window.location.origin}/pay/${linkId}`
          }
        }

        await new Promise(resolve => setTimeout(resolve, steps[i].delay))
      }

      const data = type === 'widget' ? {
        flow: type,
        steps: steps.length,
        paymentId,
        paymentData,
        paymentLink: paymentId ? `${window.location.origin}/pay/${paymentId}` : null
      } : {
        flow: type,
        steps: steps.length,
        linkId,
        paymentLinkUrl
      }

      setTestResults(prev => ({
        ...prev,
        [loadingKey]: { status: 'success', data, timestamp: new Date().toISOString() }
      }))

      toast.success(`🎉 ${type} flow completed!`)
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [loadingKey]: {
          status: 'error',
          error: error.response?.data || error.message,
          timestamp: new Date().toISOString()
        }
      }))
      toast.error(`${type} flow failed`)
    } finally {
      setLoading(prev => ({ ...prev, [loadingKey]: false }))
      setDemoRunning(false)
      setShowDemoWidget(false)
      setDemoPayment(null)
      setCurrentDemoStep(0)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <Check className="w-4 h-4" />
      case 'error': return <X className="w-4 h-4" />
      default: return null
    }
  }

  // Mock widget that mimics the real PaymentWidget UI and states
  const MockPaymentWidget = ({ payment, stepIndex }) => {
    if (!payment) return null

    // Map demo steps to widget statuses
    const status = stepIndex < 2 ? 'idle'
      : stepIndex === 2 ? 'awaiting_payment'
      : stepIndex === 3 ? 'processing'
      : stepIndex === 4 ? 'confirming'
      : 'success'

    const badge = (text, color) => (
      <span className={`px-2 py-0.5 text-xs rounded-full bg-${color}-100 text-${color}-700 border border-${color}-200`}>
        {text}
      </span>
    )

    const Tx = () => (
      <div className="text-xs text-gray-600">
        txId: 0x{Math.random().toString(16).substring(2, 18)}…
      </div>
    )

    return (
      <div className="w-full max-w-md mx-auto border rounded-xl shadow-sm overflow-hidden bg-white">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="font-medium text-gray-900">StacksPay</div>
          {status === 'success' ? badge('Success', 'green') :
           status === 'confirming' ? badge('Confirming', 'yellow') :
           status === 'processing' ? badge('Processing', 'primary') :
           status === 'awaiting_payment' ? badge('Awaiting payment', 'gray') : badge('Ready', 'gray')}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-sm text-gray-600">Amount</div>
            <div className="text-2xl font-bold text-primary-600">{payment.amount} sBTC</div>
          </div>
          <div className="text-sm text-gray-700">{payment.description}</div>
          <div className="text-xs text-gray-500">Payment ID: {payment.id}</div>

          {status === 'awaiting_payment' && (
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-primary-600 text-white rounded-md text-sm">Connect Wallet</button>
              <button className="px-3 py-2 border border-gray-300 rounded-md text-sm">Cancel</button>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Broadcasting transaction…
            </div>
          )}

          {status === 'confirming' && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              Waiting for confirmation…
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-2">
              <div className="text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm">
                Payment confirmed! Thank you.
              </div>
              <Tx />
            </div>
          )}

          <div className="text-xs text-gray-500">
            🔗 Payment Link: /pay/{payment.id}
          </div>
        </div>
      </div>
    )
  }

  const copyResult = (testId) => {
    const result = testResults[testId]
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      toast.success('📋 Copied!')
    }
  }

  const renderInputFields = (test) => {
    if (!test.hasInputs) return null
    
    const inputs = testInputs[test.id]
    
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
        <div className="text-sm font-medium text-gray-700">Test Parameters</div>
        
        {test.id === 'create-payment' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Amount (sBTC)</label>
                <input
                  type="number"
                  step="0.00001"
                  value={inputs.amount}
                  onChange={(e) => updateTestInput(test.id, 'amount', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={inputs.description}
                  onChange={(e) => updateTestInput(test.id, 'description', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Metadata (JSON)</label>
              <textarea
                value={inputs.metadata}
                onChange={(e) => updateTestInput(test.id, 'metadata', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                rows="2"
                placeholder='{"key": "value"}'
              />
            </div>
          </>
        )}
        {test.id === 'webhook-test' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                  placeholder="https://webhook.site/your-id"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Event Type</label>
                <select
                  value={webhookEventType}
                  onChange={(e) => {
                    const type = e.target.value
                    setWebhookEventType(type)
                    updateTestInput('webhook-test', 'payload', JSON.stringify(mockWebhookPayloads[type], null, 2))
                  }}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                >
                  <option value="payment.created">payment.created</option>
                  <option value="payment.processing">payment.processing</option>
                  <option value="payment.succeeded">payment.succeeded</option>
                  <option value="payment.failed">payment.failed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Secret (optional)</label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                  placeholder="Use to compute X-Webhook-Signature"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payload (fixed)</label>
              <textarea
                value={testInputs['webhook-test'].payload}
                readOnly
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 font-mono bg-gray-50"
                rows="8"
              />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API & Webhook Testing</h1>
          <p className="text-gray-300 mt-1">Test your API endpoints with custom parameters</p>
        </div>
        <button
          onClick={runAllTests}
          disabled={Object.values(loading).some(Boolean)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm flex items-center space-x-2 disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          <span>Run All Tests</span>
        </button>
      </div>

      {/* API Tests */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            API Endpoints
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {apiTests.map((test) => (
            <div key={test.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900">{test.name}</h3>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {test.method}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{test.description}</p>
                  <code className="text-xs text-gray-500 mt-1 block">{test.id === 'webhook-test' ? '/api/mock-webhooks/send' : test.endpoint}</code>
                </div>
                
                <div className="flex items-center gap-2">
                  {testResults[test.id] && (
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(testResults[test.id].status)}`}>
                      {getStatusIcon(testResults[test.id].status)}
                      {testResults[test.id].status}
                    </div>
                  )}
                  <button
                    onClick={() => runTest(test)}
                    disabled={loading[test.id]}
                    className="px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    {loading[test.id] ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    Test
                  </button>
                  {testResults[test.id] && (
                    <button
                      onClick={() => copyResult(test.id)}
                      className="px-2 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {renderInputFields(test)}
              
              {/* Request Structure */}
              <div className="mt-3 p-3 bg-primary-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Request Structure</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div><span className="font-mono bg-white px-1 rounded">{test.method}</span> {test.endpoint}</div>
                  {test.id === 'create-payment' && (
                    <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-20">
                      {JSON.stringify({
                        amount: parseFloat(testInputs[test.id]?.amount || '0.001'),
                        description: testInputs[test.id]?.description || 'Test Payment',
                        metadata: JSON.parse(testInputs[test.id]?.metadata || '{}')
                      }, null, 2)}
                    </pre>
                  )}
                  {test.id === 'webhook-test' && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-600">Backend Body</div>
                      <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">{JSON.stringify({
  url: webhookUrl,
  event: webhookEventType,
  payload: JSON.parse(testInputs['webhook-test']?.payload || '{}'),
  secret: webhookSecret ? '<provided>' : undefined
}, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>

              {testResults[test.id] && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Response</span>
                    <span className="text-xs text-gray-500">{testResults[test.id].timestamp}</span>
                  </div>
                  
                  {/* Payment Link Display */}
                  {test.id === 'create-payment' && testResults[test.id].paymentLink && (
                    <div className="mb-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-primary-900">🔗 Payment Link Created</div>
                          <div className="text-xs text-primary-700 mt-1">Share this link to accept payments</div>
                        </div>
                        <button
                          onClick={() => window.open(testResults[test.id].paymentLink, '_blank')}
                          className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                        >
                          Open Link
                        </button>
                      </div>
                      <div className="mt-2 p-2 bg-white rounded border font-mono text-xs break-all">
                        {testResults[test.id].paymentLink}
                      </div>
                    </div>
                  )}
                  
                  <pre className="text-xs text-gray-600 overflow-auto max-h-32">
                    {JSON.stringify(testResults[test.id].data || testResults[test.id].error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment Flow Simulation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Payment Flow Simulation
          </h2>
          <p className="text-sm text-gray-600 mt-1">Watch code execution in real-time</p>
        </div>
        
        <div className="p-6">
          {/* Code Flow Display */}
          {demoRunning && (
            <div className="mb-6 space-y-4">
              <div className="p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
                <div className="flex items-center gap-2 mb-3 text-white">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>Executing Flow...</span>
                </div>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {demoSteps.map((step, index) => (
                    <div key={index} className={`${
                      index < currentDemoStep ? 'text-green-400' :
                      index === currentDemoStep ? 'text-yellow-400' :
                      'text-gray-500'
                    }`}>
                      {index < currentDemoStep ? '✓' : index === currentDemoStep ? '▶' : '○'} {step.code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Widget Display */}
              {showDemoWidget && demoPayment && (
                <div className="p-4 bg-white border-2 border-primary-300 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                    Live Widget Preview
                  </div>
                  <MockPaymentWidget payment={demoPayment} stepIndex={currentDemoStep} />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => simulatePaymentFlow('widget')}
              disabled={loading.simulateWidget || demoRunning}
              className="p-6 border-2 border-dashed border-primary-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">🎮 Widget Flow</h3>
                  <p className="text-sm text-gray-600 mt-1">Watch code execute step by step</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => simulatePaymentFlow('link')}
              disabled={loading.simulateLink || demoRunning}
              className="p-6 border-2 border-dashed border-primary-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">🔗 Link Flow</h3>
                  <p className="text-sm text-gray-600 mt-1">See payment link generation</p>
                </div>
              </div>
            </button>
          </div>
          {/* Persistent Link Flow Result */}
          {testResults?.simulateLink?.data?.paymentLinkUrl && (
            <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-primary-900">🔗 Payment Link Ready</div>
                  <div className="text-xs text-primary-700 mt-1">This link was generated by the Link Flow simulation</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(testResults.simulateLink.data.paymentLinkUrl, '_blank')}
                    className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                  >
                    Open Link
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(testResults.simulateLink.data.paymentLinkUrl)}
                    className="px-3 py-1 border border-primary-300 text-primary-700 rounded text-xs hover:bg-primary-100"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="mt-2 p-2 bg-white rounded border font-mono text-xs break-all">
                {testResults.simulateLink.data.paymentLinkUrl}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default APITesting
