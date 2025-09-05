import React, { useState, useEffect } from 'react';
import { Link, Copy, ExternalLink, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

function PaymentLinks() {
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [btcPrice, setBtcPrice] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    allowCustomAmount: false,
    minAmount: '',
    maxAmount: '',
    successUrl: '',
    cancelUrl: '',
    webhookUrl: '',
    usageLimit: '',
    expiresAt: ''
  });

  useEffect(() => {
    fetchPaymentLinks();
    fetchBTCPrice();
  }, []);

  const fetchBTCPrice = async () => {
    try {
      const response = await axios.get('/api/health');
      setBtcPrice(response.data.btcPrice || 100000);
    } catch (error) {
      console.error('Error fetching BTC price:', error);
    }
  };

  // Ensure we have a merchant token for authenticated routes
  const ensureMerchantToken = async () => {
    let token = localStorage.getItem('merchantToken');
    if (token) return token;
    try {
      const health = await axios.get('/api/health');
      const merchantAddress = health.data?.merchantAddress;
      if (!merchantAddress) throw new Error('No merchantAddress');
      const login = await axios.post('/api/auth/login', { merchantAddress });
      token = login.data?.token;
      if (token) localStorage.setItem('merchantToken', token);
      return token;
    } catch (e) {
      console.error('Failed to auto-auth merchant:', e);
      return null;
    }
  };

  const fetchPaymentLinks = async () => {
    try {
      const token = await ensureMerchantToken();
      if (!token) throw new Error('Missing merchant token');
      const response = await axios.get('/api/payment-links', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // backend returns { success, links, pagination }
      setPaymentLinks(response.data?.links || response.data || []);
    } catch (error) {
      console.error('Error fetching payment links:', error);
      // Do not inject mock data that can mask real issues; show an empty list and surface an error toast instead
      setPaymentLinks([]);
      toast.error('Failed to fetch payment links. Please ensure the backend is running.');
    }
  };

  const createPaymentLink = async () => {
    setLoading(true);
    try {
      // basic validation
      if (!formData.name?.trim()) {
        toast.error('Name is required');
        return;
      }
      if (!formData.allowCustomAmount) {
        const amt = Number(formData.amount || 0);
        if (!isFinite(amt) || amt <= 0) {
          toast.error('Enter a valid sBTC amount');
          return;
        }
      }

      const token = await ensureMerchantToken();
      if (!token) throw new Error('Missing merchant token');
      const response = await axios.post('/api/payment-links', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Payment link created successfully!');
      // Refetch from server to ensure UI reflects what is actually stored in DB
      await fetchPaymentLinks();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast.error('Failed to create payment link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard!');
    } catch (e) {
      toast.error('Failed to copy');
    }
  };

  const toggleLinkStatus = async (linkId, currentStatus) => {
    try {
      const token = await ensureMerchantToken();
      if (!token) throw new Error('Missing merchant token');
      await axios.put(`/api/payment-links/${linkId}`, 
        { isActive: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPaymentLinks(paymentLinks.map(link => 
        link.id === linkId ? { ...link, isActive: !currentStatus } : link
      ));
      
      toast.success(`Payment link ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating link status:', error);
      toast.error('Failed to update link status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      amount: '',
      allowCustomAmount: false,
      minAmount: '',
      maxAmount: '',
      successUrl: '',
      cancelUrl: '',
      webhookUrl: '',
      usageLimit: '',
      expiresAt: ''
    });
  };

  const generateEmbedCode = (linkId) => {
    const embedCode = `<script src="${window.location.origin}/widget.js"></script>
<div id="sbtc-payment-${linkId}"></div>
<script>
  SBTCPaymentWidget.init({
    linkId: '${linkId}',
    container: 'sbtc-payment-${linkId}'
  });
</script>`;
    
    navigator.clipboard.writeText(embedCode);
    toast.success('Embed code copied to clipboard!');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="StacksPay Logo" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-white">Payment Links</h1>
            <p className="text-white/70 mt-2">Create and manage reusable sBTC payment links</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Link
        </button>
      </div>

      {/* Payment Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paymentLinks.map((link) => (
          <div key={link.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{link.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{link.description}</p>
              </div>
              <button
                onClick={() => toggleLinkStatus(link.id, link.isActive)}
                className="ml-2"
              >
                {link.isActive ? (
                  <ToggleRight className="w-8 h-8 text-green-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">
                  {link.allowCustomAmount ? 'Custom' :
                    link.amount ? `${Number(link.amount).toFixed(8)} sBTC` : '-'}
                </span>
              </div>
              {!link.allowCustomAmount && (
                <div className="flex justify-end text-xs">
                  <span className="text-gray-500">≈ ${link.amount && btcPrice ? (Number(link.amount) * btcPrice).toFixed(2) : '0.00'}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Usage:</span>
                <span className="font-medium">
                  {link.usageCount} / {link.usageLimit || '∞'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Created:</span>
                <div className="text-right">
                  <div className="font-medium">
                    {new Date(link.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(link.createdAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
              <button
                onClick={() => copyToClipboard(link.link || `${window.location.origin}/pay/${link.id}`)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              
              <button
                onClick={() => window.open(link.link || `${window.location.origin}/pay/${link.id}`, '_blank')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border text-gray-800 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open Link
              </button>

              <button
                onClick={() => generateEmbedCode(link.id)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Get Embed Code
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Payment Link Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Create Payment Link</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Premium Subscription"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows="3"
                  placeholder="Brief description of the payment"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowCustom"
                  checked={formData.allowCustomAmount}
                  onChange={(e) => setFormData({ ...formData, allowCustomAmount: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="allowCustom" className="text-sm font-medium text-gray-700">
                  Allow custom amount
                </label>
              </div>

              {!formData.allowCustomAmount ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (sBTC)
                    </label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0.00000000"
                      step="0.00000001"
                    />
                  </div>
                  <p className="text-xs text-gray-500">≈ ${formData.amount && btcPrice ? (Number(formData.amount) * btcPrice).toFixed(2) : '0.00'} USD</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Amount (sBTC)
                    </label>
                    <input
                      type="number"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00000000"
                      step="0.00000001"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Amount (sBTC)
                    </label>
                    <input
                      type="number"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00000000"
                      step="0.00000001"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Success URL
                </label>
                <input
                  type="url"
                  value={formData.successUrl}
                  onChange={(e) => setFormData({ ...formData, successUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://example.com/success"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://example.com/webhook"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Unlimited"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires At
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPaymentLink}
                disabled={loading || !formData.name}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentLinks;
