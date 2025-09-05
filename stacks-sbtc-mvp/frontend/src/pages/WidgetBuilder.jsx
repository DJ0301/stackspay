import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Copy, Play, RefreshCw } from 'lucide-react';
import { EmbeddablePaymentWidget } from '../components/EmbeddableWidget';

function WidgetBuilder() {
  const navigate = useNavigate();
  const [btcPrice, setBtcPrice] = useState(0);
  const [mode, setMode] = useState('sbtc'); // 'sbtc' | 'usd'
  const [form, setForm] = useState({
    sbtcAmount: '0.001000',
    usdAmount: '50.00',
    showQR: true,
    showEmail: false,
    allowCustomAmount: false,
    minAmount: '0.0001',
    maxAmount: '1.0',
    showLogo: true,
    logoUrl: '',
    buttonText: 'Pay with sBTC',
    successMessage: '✓ Payment successful!',
    errorMessage: 'Payment failed. Please try again.',
    showPoweredBy: true,
    width: '400px',
    height: 'auto',
    position: 'center',
    description: 'Complete Payment',
    theme: {
      primaryColor: '#F7931A',
      secondaryColor: '#6B7280',
      backgroundColor: '#FFFFFF',
      textColor: '#111827',
      borderColor: '#E5E7EB',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      borderRadius: '8px',
      borderWidth: '1px',
      padding: '20px',
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      buttonPadding: '12px 24px',
      buttonTextColor: '#FFFFFF',
      buttonFontSize: '16px',
      buttonFontWeight: '600',
      amountBackgroundColor: '#F9FAFB',
      amountBorderColor: '#E5E7EB',
      amountTextColor: '#111827',
      amountFontSize: '24px',
      successBackgroundColor: '#D1FAE5',
      successTextColor: '#065F46',
      errorBackgroundColor: '#FEE2E2',
      errorTextColor: '#991B1B',
      poweredByColor: '#9CA3AF'
    },
    metadata: { orderId: '', customerEmail: '' }
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/health');
        setBtcPrice(data.btcPrice || 100000);
      } catch {}
    })();
  }, []);

  const microsFromSbtc = (s) => {
    const n = Number(s || 0);
    // 1 sBTC == 1,000,000 micro-sats used by widget
    return Math.round(n * 1_000_000);
  };

  const openWidget = () => {
    const base = window.location.origin;
    const config = {
      amount: mode === 'sbtc' ? Number(form.sbtcAmount) : undefined,
      amountUSD: mode === 'usd' ? Number(form.usdAmount) : undefined,
      description: form.description,
      showEmail: form.showEmail,
      allowCustomAmount: form.allowCustomAmount,
      minAmount: form.allowCustomAmount ? Number(form.minAmount) : undefined,
      maxAmount: form.allowCustomAmount ? Number(form.maxAmount) : undefined,
      showLogo: form.showLogo,
      logoUrl: form.logoUrl || undefined,
      buttonText: form.buttonText,
      successMessage: form.successMessage,
      errorMessage: form.errorMessage,
      showPoweredBy: form.showPoweredBy,
      width: form.width,
      height: form.height,
      position: form.position,
      theme: form.theme,
      metadata: form.metadata
    };
    const c = encodeURIComponent(JSON.stringify(config));
    window.open(`${base}/widget?c=${c}`, '_blank');
  };

  const sbtcFromUsd = (usd) => {
    const u = Number(usd || 0);
    if (!btcPrice) return 0;
    const btc = u / btcPrice; // BTC units
    return btc; // sBTC numerically equal to BTC here
  };

  const derived = useMemo(() => {
    if (mode === 'sbtc') {
      const sbtc = Number(form.sbtcAmount || 0);
      return {
        amountMicros: microsFromSbtc(sbtc),
        usd: (sbtc * btcPrice).toFixed(2)
      };
    } else {
      const usd = Number(form.usdAmount || 0);
      const sbtc = sbtcFromUsd(usd);
      return {
        amountMicros: microsFromSbtc(sbtc),
        usd: usd.toFixed(2)
      };
    }
  }, [mode, form.sbtcAmount, form.usdAmount, btcPrice]);

  const embedCode = useMemo(() => {
    const base = window.location.origin;
    const config = {
      amount: mode === 'sbtc' ? Number(form.sbtcAmount) : undefined,
      amountUSD: mode === 'usd' ? Number(form.usdAmount) : undefined,
      description: form.description,
      showEmail: form.showEmail,
      allowCustomAmount: form.allowCustomAmount,
      minAmount: form.allowCustomAmount ? Number(form.minAmount) : undefined,
      maxAmount: form.allowCustomAmount ? Number(form.maxAmount) : undefined,
      showLogo: form.showLogo,
      logoUrl: form.logoUrl || undefined,
      buttonText: form.buttonText,
      successMessage: form.successMessage,
      errorMessage: form.errorMessage,
      showPoweredBy: form.showPoweredBy,
      width: form.width,
      height: form.height,
      position: form.position,
      theme: form.theme,
      metadata: form.metadata
    };
    
    return `<!-- sBTC Payment Widget -->
<script src="${base}/widget.js"></script>
<div id="sbtc-payment-widget"></div>
<script>
  SBTCPaymentWidget.init(${JSON.stringify(config, null, 2)});
</script>`;
  }, [mode, form, derived]);

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success('Embed code copied');
    } catch (e) {
      toast.error('Failed to copy');
    }
  };

  const reset = () => {
    setMode('sbtc');
    setForm({
      sbtcAmount: '0.001000',
      usdAmount: '50.00',
      showQR: true,
      showEmail: false,
      allowCustomAmount: false,
      minAmount: '0.0001',
      maxAmount: '1.0',
      showLogo: true,
      logoUrl: '',
      buttonText: 'Pay with sBTC',
      successMessage: '✓ Payment successful!',
      errorMessage: 'Payment failed. Please try again.',
      showPoweredBy: true,
      width: '400px',
      height: 'auto',
      position: 'center',
      description: 'Complete Payment',
      theme: {
        primaryColor: '#F7931A',
        secondaryColor: '#6B7280',
        backgroundColor: '#FFFFFF',
        textColor: '#111827',
        borderColor: '#E5E7EB',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        borderRadius: '8px',
        borderWidth: '1px',
        padding: '20px',
        shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        buttonPadding: '12px 24px',
        buttonTextColor: '#FFFFFF',
        buttonFontSize: '16px',
        buttonFontWeight: '600',
        amountBackgroundColor: '#F9FAFB',
        amountBorderColor: '#E5E7EB',
        amountTextColor: '#111827',
        amountFontSize: '24px',
        successBackgroundColor: '#D1FAE5',
        successTextColor: '#065F46',
        errorBackgroundColor: '#FEE2E2',
        errorTextColor: '#991B1B',
        poweredByColor: '#9CA3AF'
      },
      metadata: { orderId: '', customerEmail: '' }
    });
  };

  const createPayment = async () => {
    try {
      const payload = mode === 'sbtc'
        ? { amount: Number(form.sbtcAmount || 0), metadata: form.metadata }
        : { amountUSD: Number(form.usdAmount || 0), metadata: form.metadata };

      const { data } = await axios.post('/api/payments/create', payload);
      if (data?.id) {
        toast.success('Payment created');
        navigate(`/pay/${data.id}`);
      } else {
        throw new Error('Invalid response');
      }
    } catch (e) {
      toast.error('Failed to create payment');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Widget Builder</h1>
        <p className="text-gray-300 mt-2">Configure, preview, and generate an embeddable sBTC payment widget.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Configuration */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Basic Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount</label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    className={`px-3 py-1 rounded-lg text-sm border ${mode==='sbtc' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white'}`}
                    onClick={() => setMode('sbtc')}
                  >sBTC</button>
                  <button
                    className={`px-3 py-1 rounded-lg text-sm border ${mode==='usd' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white'}`}
                    onClick={() => setMode('usd')}
                  >USD</button>
                </div>
                {mode === 'sbtc' ? (
                  <>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.sbtcAmount}
                      onChange={(e) => setForm({ ...form, sbtcAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="text-xs text-gray-500 mt-1">≈ ${derived.usd} USD</div>
                  </>
                ) : (
                  <>
                    <input
                    type="number"
                    step="0.01"
                    value={form.usdAmount}
                    onChange={(e) => setForm({ ...form, usdAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Complete Payment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="allowCustomAmount"
                    type="checkbox"
                    checked={form.allowCustomAmount}
                    onChange={(e) => setForm({ ...form, allowCustomAmount: e.target.checked })}
                  />
                  <label htmlFor="allowCustomAmount" className="text-sm text-gray-700">Allow Custom Amount</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="showEmail"
                    type="checkbox"
                    checked={form.showEmail}
                    onChange={(e) => setForm({ ...form, showEmail: e.target.checked })}
                  />
                  <label htmlFor="showEmail" className="text-sm text-gray-700">Show Email Field</label>
                </div>
              </div>

              {form.allowCustomAmount && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.minAmount}
                      onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.maxAmount}
                      onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Appearance & Branding</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="showLogo"
                    type="checkbox"
                    checked={form.showLogo}
                    onChange={(e) => setForm({ ...form, showLogo: e.target.checked })}
                  />
                  <label htmlFor="showLogo" className="text-sm text-gray-700">Show Logo Section</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="showPoweredBy"
                    type="checkbox"
                    checked={form.showPoweredBy}
                    onChange={(e) => setForm({ ...form, showPoweredBy: e.target.checked })}
                  />
                  <label htmlFor="showPoweredBy" className="text-sm text-gray-700">Show "Powered By"</label>
                </div>
              </div>

              {form.showLogo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input
                    type="url"
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Widget Width</label>
                  <input
                    type="text"
                    value={form.width}
                    onChange={(e) => setForm({ ...form, width: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="400px"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>

          {/* Colors & Styling */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Colors & Styling</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <input
                    type="color"
                    value={form.theme.primaryColor}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, primaryColor: e.target.value } })}
                    className="w-full h-10 p-1 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
                  <input
                    type="color"
                    value={form.theme.backgroundColor}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, backgroundColor: e.target.value } })}
                    className="w-full h-10 p-1 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                  <input
                    type="color"
                    value={form.theme.textColor}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, textColor: e.target.value } })}
                    className="w-full h-10 p-1 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Border Radius</label>
                  <input
                    type="text"
                    value={form.theme.borderRadius}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, borderRadius: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="8px"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={form.theme.fontFamily}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, fontFamily: e.target.value } })}
                  >
                    <option value="Inter, system-ui, sans-serif">Inter</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Courier New', monospace">Courier New</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Messages</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Success Message</label>
                <input
                  type="text"
                  value={form.successMessage}
                  onChange={(e) => setForm({ ...form, successMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Error Message</label>
                <input
                  type="text"
                  value={form.errorMessage}
                  onChange={(e) => setForm({ ...form, errorMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Metadata</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                <input
                  type="text"
                  value={form.metadata.orderId}
                  onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, orderId: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
                <input
                  type="email"
                  value={form.metadata.customerEmail}
                  onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, customerEmail: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Embed Code */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Embed Code</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Generated Code</label>
              <textarea
                readOnly
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                value={embedCode}
              />
              <div className="mt-2 flex items-center gap-2">
                <button onClick={copyEmbed} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50">
                  <Copy className="w-4 h-4" /> Copy Embed
                </button>
                <button onClick={reset} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50">
                  <RefreshCw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button onClick={createPayment} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Play className="w-4 h-4" /> Create Payment & Open Checkout
              </button>
              <button onClick={openWidget} className="ml-2 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900">
                <Play className="w-4 h-4" /> Open Widget (Preview)
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Live Preview</h2>
          <div className="border rounded-lg p-4 bg-gray-50">
            <EmbeddablePaymentWidget
              apiUrl={import.meta?.env?.VITE_API_URL || ''}
              merchantAddress="ST3P5115329Z40SSHC2KXFN89T5R5QRJGCJCP4RQP"
              amount={mode === 'sbtc' ? Number(form.sbtcAmount) : undefined}
              amountUSD={mode === 'usd' ? Number(form.usdAmount) : undefined}
              description={form.description}
              metadata={form.metadata}
              theme={form.theme}
              showEmail={form.showEmail}
              allowCustomAmount={form.allowCustomAmount}
              minAmount={form.allowCustomAmount ? Number(form.minAmount) : undefined}
              maxAmount={form.allowCustomAmount ? Number(form.maxAmount) : undefined}
              showLogo={form.showLogo}
              logoUrl={form.logoUrl || undefined}
              buttonText={form.buttonText}
              successMessage={form.successMessage}
              errorMessage={form.errorMessage}
              showPoweredBy={form.showPoweredBy}
              width={form.width}
              height={form.height}
              position={form.position}
              onSuccess={(data) => {
                console.log('Preview payment success:', data);
                toast.success('Preview payment completed!');
              }}
              onError={(error) => {
                console.log('Preview payment error:', error);
                toast.error('Preview payment failed');
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WidgetBuilder;
