import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Drop-in checkout components library similar to Stripe Elements

// Payment Button Component
export function PaymentButton({ 
  amount,
  currency = 'sBTC',
  label = 'Pay Now',
  size = 'medium',
  variant = 'primary',
  disabled = false,
  loading = false,
  onClick,
  className = ''
}) {
  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  };

  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        font-semibold rounded-lg transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {label}
          {amount && (
            <span className="ml-1">
              • {amount} {currency}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// Checkout Form Component
export function CheckoutForm({
  amount,
  amountUSD,
  onSubmit,
  onCancel,
  showEmail = true,
  showAddress = false,
  metadata = {},
  className = ''
}) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    ...metadata
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    if (showEmail && !formData.email) {
      newErrors.email = 'Email is required';
    } else if (showEmail && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    
    if (showAddress) {
      if (!formData.address) newErrors.address = 'Address is required';
      if (!formData.city) newErrors.city = 'City is required';
      if (!formData.country) newErrors.country = 'Country is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {/* Amount Display */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Amount</span>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {amount ? `${amount} sBTC` : `$${amountUSD}`}
            </div>
            <div className="text-sm text-gray-500">
              {amount ? `≈ $${amountUSD || '0.00'}` : `≈ ${amount || '0.00000000'} sBTC`}
            </div>
          </div>
        </div>
      </div>

      {/* Email Field */}
      {showEmail && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={`
              w-full px-3 py-2 border rounded-lg
              focus:outline-none focus:ring-2 focus:ring-primary-500
              ${errors.email ? 'border-red-500' : 'border-gray-300'}
            `}
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>
      )}

      {/* Address Fields */}
      {showAddress && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={`
                w-full px-3 py-2 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500
                ${errors.address ? 'border-red-500' : 'border-gray-300'}
              `}
              placeholder="123 Main St"
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-500">{errors.address}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500
                  ${errors.city ? 'border-red-500' : 'border-gray-300'}
                `}
                placeholder="New York"
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-500">{errors.city}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code
              </label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="10001"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className={`
                w-full px-3 py-2 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500
                ${errors.country ? 'border-red-500' : 'border-gray-300'}
              `}
            >
              <option value="">Select Country</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
              <option value="SG">Singapore</option>
            </select>
            {errors.country && (
              <p className="mt-1 text-sm text-red-500">{errors.country}</p>
            )}
          </div>
        </>
      )}

      {/* Submit Buttons */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Pay with sBTC
            </>
          )}
        </button>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2">
        <Lock className="w-3 h-3" />
        <span>Secured by sBTC blockchain</span>
      </div>
    </form>
  );
}

// Payment Status Component
export function PaymentStatus({ 
  status = 'pending',
  txId,
  amount,
  className = ''
}) {
  const statusConfig = {
    pending: {
      icon: Loader2,
      color: 'text-yellow-600 bg-yellow-50',
      message: 'Payment pending...',
      iconClass: 'animate-spin'
    },
    processing: {
      icon: Loader2,
      color: 'text-primary-600 bg-primary-50',
      message: 'Processing payment...',
      iconClass: 'animate-spin'
    },
    success: {
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
      message: 'Payment successful!',
      iconClass: ''
    },
    failed: {
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50',
      message: 'Payment failed',
      iconClass: ''
    }
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg p-6 ${config.color} ${className}`}>
      <div className="flex flex-col items-center text-center">
        <Icon className={`w-12 h-12 mb-3 ${config.iconClass}`} />
        <h3 className="text-lg font-semibold mb-2">{config.message}</h3>
        
        {amount && (
          <p className="text-sm opacity-75">
            Amount: {amount} sBTC
          </p>
        )}
        
        {txId && status === 'success' && (
          <div className="mt-4">
            <a
              href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline hover:no-underline"
            >
              View transaction →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Payment Card Component
export function PaymentCard({
  title = 'Complete Payment',
  description,
  amount,
  amountUSD,
  onSuccess,
  onError,
  showEmail = true,
  showAddress = false,
  theme = {},
  className = ''
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`
      border border-gray-200 rounded-xl overflow-hidden
      transition-all duration-300
      ${expanded ? 'shadow-lg' : 'shadow-sm'}
      ${className}
    `}>
      <div 
        className="p-4 bg-white cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="font-bold text-lg">
              {amount ? `${amount} sBTC` : `$${amountUSD}`}
            </div>
            <CreditCard className="w-5 h-5 text-gray-400 mt-1 ml-auto" />
          </div>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <CheckoutForm
            amount={amount}
            amountUSD={amountUSD}
            onSubmit={onSuccess}
            onCancel={() => setExpanded(false)}
            showEmail={showEmail}
            showAddress={showAddress}
          />
        </div>
      )}
    </div>
  );
}

// Export all components
export default {
  PaymentButton,
  CheckoutForm,
  PaymentStatus,
  PaymentCard
};
