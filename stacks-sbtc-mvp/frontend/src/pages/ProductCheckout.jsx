import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ShoppingCart, 
  User, 
  Mail, 
  CreditCard, 
  Shield, 
  ArrowLeft, 
  Check,
  AlertCircle,
  Loader,
  Star,
  Truck,
  RefreshCw
} from 'lucide-react'
import axios from 'axios'
import PaymentWidget from '../components/PaymentWidget'

function ProductCheckout() {
  const { productId } = useParams()
  const navigate = useNavigate()
  
  // Product and pricing state
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [btcPrice, setBtcPrice] = useState(0)
  
  // Customer form state
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    agreeToTerms: false
  })
  const [customerErrors, setCustomerErrors] = useState({})
  
  // Checkout flow state
  const [step, setStep] = useState('details') // details, payment, confirmation
  const [payment, setPayment] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchProduct()
    fetchBTCPrice()
  }, [productId])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('merchantToken')
      const response = await axios.get(`/api/merchant/products`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const products = response.data || []
      const foundProduct = products.find(p => p.id === productId)
      
      if (!foundProduct) {
        setError('Product not found')
        return
      }
      
      setProduct(foundProduct)
    } catch (error) {
      console.error('Error fetching product:', error)
      setError('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const fetchBTCPrice = async () => {
    try {
      const res = await axios.get('/api/health')
      setBtcPrice(res.data?.btcPrice || 0)
    } catch (e) {
      console.error('Error fetching BTC price:', e)
    }
  }

  const validateCustomerInfo = () => {
    const errors = {}
    
    if (!customerInfo.name.trim()) {
      errors.name = 'Name is required'
    }
    
    if (!customerInfo.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(customerInfo.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    if (!customerInfo.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the terms and conditions'
    }
    
    setCustomerErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCustomerInfoChange = (field, value) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (customerErrors[field]) {
      setCustomerErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const proceedToPayment = async () => {
    if (!validateCustomerInfo()) {
      return
    }
    
    try {
      setSubmitting(true)
      
      // Create payment with customer metadata
      const paymentData = {
        amount: product.price,
        metadata: {
          productId: product.id,
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          productName: product.name,
          checkoutType: 'product'
        }
      }
      
      const response = await axios.post('/api/payments/create', paymentData)
      setPayment(response.data)
      setStep('payment')
    } catch (error) {
      console.error('Error creating payment:', error)
      setError('Failed to create payment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaymentSuccess = (paymentResult) => {
    setPaymentStatus('success')
    setStep('confirmation')
    
    // Track the payment completion
    if (paymentResult.txId) {
      // Payment widget will handle the confirmation API call
      console.log('Payment completed with txId:', paymentResult.txId)
    }
  }

  const handlePaymentError = (error) => {
    setPaymentStatus('error')
    setError(error.message || 'Payment failed. Please try again.')
  }

  const formatCurrency = (amount) => {
    const sbtc = `${amount.toFixed(8)} sBTC`
    if (btcPrice > 0) {
      const usd = ` (≈ $${(amount * btcPrice).toFixed(2)})`
      return sbtc + usd
    }
    return sbtc
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (error && !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/products')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Products
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/products')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Checkout</h1>
              <p className="text-sm text-gray-600">Secure payment powered by sBTC</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Product Info & Customer Details */}
          <div className="space-y-6">
            {/* Product Summary */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Your Order
              </h2>
              
              <div className="flex gap-4">
                {product.imageUrl && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/80x80?text=Product'
                      }}
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                  )}
                  
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(product.price)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Trust indicators */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span>Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span>Instant Delivery</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information Form */}
            {step === 'details' && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Information
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => handleCustomerInfoChange('name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        customerErrors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {customerErrors.name && (
                      <p className="text-sm text-red-600 mt-1">{customerErrors.name}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => handleCustomerInfoChange('email', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        customerErrors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your email address"
                    />
                    {customerErrors.email && (
                      <p className="text-sm text-red-600 mt-1">{customerErrors.email}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      We'll send your receipt and product access to this email
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="agreeToTerms"
                      checked={customerInfo.agreeToTerms}
                      onChange={(e) => handleCustomerInfoChange('agreeToTerms', e.target.checked)}
                      className="mt-1"
                    />
                    <label htmlFor="agreeToTerms" className="text-sm text-gray-600">
                      I agree to the{' '}
                      <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </label>
                  </div>
                  {customerErrors.agreeToTerms && (
                    <p className="text-sm text-red-600">{customerErrors.agreeToTerms}</p>
                  )}
                </div>
                
                <button
                  onClick={proceedToPayment}
                  disabled={submitting}
                  className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Creating Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Proceed to Payment
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Payment Success Message */}
            {step === 'confirmation' && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h2>
                  <p className="text-gray-600 mb-4">
                    Thank you for your purchase, {customerInfo.name}. We've sent a confirmation email to {customerInfo.email}.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => navigate('/products')}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Continue Shopping
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Make Another Purchase
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Payment Widget */}
          <div className="lg:sticky lg:top-8">
            {step === 'payment' && payment && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Complete Payment
                </h2>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}
                
                <PaymentWidget
                  paymentId={payment.id}
                  amount={payment.amount}
                  merchantAddress={payment.merchantAddress}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  metadata={{
                    ...payment.metadata,
                    customerName: customerInfo.name,
                    customerEmail: customerInfo.email
                  }}
                />
              </div>
            )}
            
            {step === 'confirmation' && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product:</span>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{customerInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{customerInfo.email}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Paid:</span>
                      <span>{formatCurrency(product.price)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductCheckout
