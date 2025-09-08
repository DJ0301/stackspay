import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CreditCard, 
  RefreshCw, 
  XCircle, 
  CheckCircle,
  Clock,
  DollarSign,
  User,
  AlertCircle,
  Plus
} from 'lucide-react';
import axios from 'axios';

// Module-scope helper to ensure auth token exists
const ensureAuthToken = async () => {
  const existing = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (existing) return existing;
  let merchantAddress = (typeof window !== 'undefined' ? localStorage.getItem('stxAddress') : '') || (import.meta?.env?.VITE_MERCHANT_ADDRESS) || '';
  const base = (import.meta?.env?.VITE_API_URL) || ''
  if (!merchantAddress) {
    try {
      if (!base) {
        console.warn('[Subscriptions] VITE_API_URL is not set; attempting same-origin /api/health');
      }
      const health = await axios.get(`${base}/api/health`);
      merchantAddress = health?.data?.merchantAddress || '';
    } catch (e) {
      console.error('Failed to fetch merchant from /api/health:', e);
    }
  }
  if (!merchantAddress) return null;
  try {
    const resp = await axios.post(`${base}/api/auth/login`, { merchantAddress });
    const token = resp?.data?.token;
    if (token && typeof window !== 'undefined') localStorage.setItem('authToken', token);
    return token || null;
  } catch (e) {
    console.error('Auto-login failed:', e);
    return null;
  }
};

const Subscriptions = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({
    active: 0,
    cancelled: 0,
    revenue: 0,
    nextPayouts: 0
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);

  useEffect(() => {
    (async () => {
      await ensureAuthToken();
      await fetchSubscriptions();
      await fetchStats();
    })();
  }, []);

  const fetchSubscriptions = async (attempt = 0) => {
    try {
      const base = (import.meta?.env?.VITE_API_URL) || ''
      const response = await axios.get(`${base}/api/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = response.data;
      setSubscriptions(Array.isArray(data) ? data : (data.items || []));
      setLoading(false);
    } catch (error) {
      if (error?.response?.status === 401 && attempt < 1) {
        await ensureAuthToken();
        return fetchSubscriptions(attempt + 1);
      }
      console.error('Error fetching subscriptions:', error);
      setLoading(false);
    }
  };

  const fetchStats = async (attempt = 0) => {
    try {
      const base = (import.meta?.env?.VITE_API_URL) || ''
      const response = await axios.get(`${base}/api/subscriptions/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setStats(response.data);
    } catch (error) {
      if (error?.response?.status === 401 && attempt < 1) {
        await ensureAuthToken();
        return fetchStats(attempt + 1);
      }
      console.error('Error fetching stats:', error);
    }
  };

  const handleCancelSubscription = async (subscriptionId) => {
    if (!window.confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    try {
      const base = (import.meta?.env?.VITE_API_URL) || ''
      await axios.put(
        `${base}/api/subscriptions/${subscriptionId}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );
      fetchSubscriptions();
      fetchStats();
    } catch (error) {
      if (error?.response?.status === 401) {
        await ensureAuthToken();
        return handleCancelSubscription(subscriptionId);
      }
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription');
    }
  };

  const getIntervalLabel = (interval) => {
    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly'
    };
    return labels[interval] || interval;
  };

  const getStatusBadge = (subscription) => {
    if (subscription.cancelledAt) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelled
        </span>
      );
    }
    if (subscription.pausedAt) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Paused
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-white/70 mt-1">Manage recurring payments and subscriptions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Subscription</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70 mb-1">Active Subscriptions</p>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70 mb-1">Cancelled</p>
              <p className="text-2xl font-bold text-white">{stats.cancelled}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70 mb-1">Monthly Revenue</p>
              <p className="text-2xl font-bold text-white">{(stats.revenue || 0).toFixed(8)} sBTC</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70 mb-1">Next Payouts (30d)</p>
              <p className="text-2xl font-bold text-white">{stats.nextPayouts}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-medium text-white">All Subscriptions</h2>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-white/60" />
            <p className="mt-2 text-white/60">Loading subscriptions...</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-white/40" />
            <p className="mt-2 text-white/60">No subscriptions yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
            >
              Create your first subscription
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Interval
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Next Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-5 h-5 text-white/60 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-white">
                            {subscription.customerEmail || subscription.metadata?.customerEmail || 'Anonymous'}
                          </div>
                          <div className="text-xs text-white/50">
                            {subscription.customerAddress?.slice(0, 10)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{subscription.planName || subscription.metadata?.planName || subscription.planId || 'Standard'}</div>
                      <div className="text-xs text-white/60">{subscription.description || subscription.metadata?.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {(subscription.amount || 0).toFixed(8)} sBTC
                      </div>
                      <div className="text-xs text-white/60">
                        {subscription.amountUSD ? `$${subscription.amountUSD} USD` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <RefreshCw className="w-4 h-4 text-white/60 mr-2" />
                        <span className="text-sm text-white">
                          {getIntervalLabel(subscription.interval)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-white/60 mr-2" />
                        <span className="text-sm text-white">
                          {subscription.nextPaymentDate ? new Date(subscription.nextPaymentDate).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(subscription)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedSubscription(subscription)}
                        className="text-orange-400 hover:text-orange-300 mr-4"
                      >
                        View
                      </button>
                      {!subscription.cancelledAt && (
                        <button
                          onClick={() => handleCancelSubscription(subscription.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Subscription Modal */}
      {showCreateModal && (
        <CreateSubscriptionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchSubscriptions();
            fetchStats();
          }}
        />
      )}

      {/* Subscription Details Modal */}
      {selectedSubscription && (
        <SubscriptionDetailsModal
          subscription={selectedSubscription}
          onClose={() => setSelectedSubscription(null)}
        />
      )}
    </div>
  );
};

// Create Subscription Modal Component
const CreateSubscriptionModal = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    planName: '',
    description: '',
    amount: '',
    amountUSD: '',
    interval: 'monthly',
    customerEmail: '',
    trialDays: 0
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const base = (import.meta?.env?.VITE_API_URL) || ''
      const payload = {
        // Prefer sBTC amount; allow USD if provided
        amount: formData.amount ? parseFloat(formData.amount) : undefined,
        amountUSD: !formData.amount && formData.amountUSD ? parseFloat(formData.amountUSD) : undefined,
        interval: formData.interval,
        planId: formData.planName ? formData.planName.trim().toLowerCase().replace(/\s+/g, '-') : undefined,
        metadata: {
          planName: formData.planName,
          description: formData.description,
          customerEmail: formData.customerEmail,
          trialDays: formData.trialDays ? Number(formData.trialDays) : 0
        }
      };
      await axios.post(
        `${base}/api/subscriptions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );
      onCreated();
    } catch (error) {
      if (error?.response?.status === 401) {
        await ensureAuthToken();
        return handleSubmit(e);
      }
      console.error('Error creating subscription:', error);
      alert('Failed to create subscription');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Subscription</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Plan Name</label>
              <input
                type="text"
                value={formData.planName}
                onChange={(e) => setFormData({...formData, planName: e.target.value})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                rows="2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (sBTC)</label>
                <input
                  type="number"
                  step="0.00000001"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amountUSD}
                  onChange={(e) => setFormData({...formData, amountUSD: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Billing Interval</label>
              <select
                value={formData.interval}
                onChange={(e) => setFormData({...formData, interval: e.target.value})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Email</label>
              <input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                required
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Create Subscription
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Subscription Details Modal Component
const SubscriptionDetailsModal = ({ subscription, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-medium text-gray-900">Subscription Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Subscription ID</p>
              <p className="mt-1 text-sm text-gray-900">{subscription.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <div className="mt-1">{getStatusBadge(subscription)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Customer</p>
              <p className="mt-1 text-sm text-gray-900">{subscription.customerEmail}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Amount</p>
              <p className="mt-1 text-sm text-gray-900">
                {subscription.amount} sBTC ({subscription.amountUSD ? `$${subscription.amountUSD} USD` : ''})
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Created</p>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(subscription.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Next Payment</p>
              <p className="mt-1 text-sm text-gray-900">
                {subscription.nextPaymentDate ? new Date(subscription.nextPaymentDate).toLocaleString() : '-'}
              </p>
            </div>
          </div>
          
          {subscription.paymentHistory && subscription.paymentHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Payment History</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">TX ID</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subscription.paymentHistory.map((payment, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {new Date(payment.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{payment.amount} sBTC</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                            payment.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {payment.txId?.slice(0, 10)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function for status badge (used in modal)
const getStatusBadge = (subscription) => {
  if (subscription.cancelledAt) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="w-3 h-3 mr-1" />
        Cancelled
      </span>
    );
  }
  if (subscription.pausedAt) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <CheckCircle className="w-3 h-3 mr-1" />
      Active
    </span>
  );
};

export default Subscriptions;
