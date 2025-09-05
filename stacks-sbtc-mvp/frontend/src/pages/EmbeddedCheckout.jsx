import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { PaymentCard, PaymentButton, CheckoutForm } from '../components/CheckoutElements';

function EmbeddedCheckout() {
  const [creating, setCreating] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [btcPrice, setBtcPrice] = useState(0);
  const [mode, setMode] = useState('usd'); // 'usd' | 'sbtc'
  const [form, setForm] = useState({
    usdAmount: '10.00',
    sbtcAmount: '0.001000',
    showEmail: true,
    showAddress: false,
    title: 'Pro Plan',
    description: 'Access to all premium features',
    metadata: { source: 'embedded-checkout-demo' }
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/health');
        setBtcPrice(data.btcPrice || 100000);
      } catch {}
    })();
  }, []);

  const derived = useMemo(() => {
    if (mode === 'usd') {
      return {
        usd: Number(form.usdAmount || 0),
        sbtc: btcPrice ? Number(form.usdAmount || 0) / btcPrice : 0
      };
    }
    const sbtc = Number(form.sbtcAmount || 0);
    return {
      usd: (sbtc * btcPrice),
      sbtc
    };
  }, [mode, form.usdAmount, form.sbtcAmount, btcPrice]);

  const createPayment = async (openInNewTab = true) => {
    setCreating(true);
    try {
      // basic validation of amounts
      if (mode === 'usd') {
        const usd = Number(form.usdAmount || 0);
        if (!isFinite(usd) || usd <= 0) {
          toast.error('Enter a valid USD amount');
          return;
        }
      } else {
        const sbtc = Number(form.sbtcAmount || 0);
        if (!isFinite(sbtc) || sbtc <= 0) {
          toast.error('Enter a valid sBTC amount');
          return;
        }
      }

      const payload = mode === 'usd'
        ? { amountUSD: Number(form.usdAmount || 0), metadata: form.metadata }
        : { amount: Number(form.sbtcAmount || 0), metadata: form.metadata };

      const { data } = await axios.post('/api/payments/create', payload);
      setLastPayment(data);
      const url = `/pay/${data.id}`;
      if (openInNewTab) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    } catch (e) {
      console.error('Failed to create payment', e);
      toast.error('Failed to create payment');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    try {
      if (!lastPayment?.id) {
        toast.error('No payment yet');
        return;
      }
      const url = `${window.location.origin}/pay/${lastPayment.id}`;
      await navigator.clipboard.writeText(url);
      toast.success('Checkout link copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const reset = () => {
    setMode('usd');
    setForm({
      usdAmount: '10.00',
      sbtcAmount: '0.001000',
      showEmail: true,
      showAddress: false,
      title: 'Pro Plan',
      description: 'Access to all premium features',
      metadata: { source: 'embedded-checkout-demo' }
    });
    setLastPayment(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Embedded Checkout</h1>
        <p className="text-white/70 mt-2">Drop-in components to accept sBTC on your site.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Config + Actions */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Configuration</h2>
          <p className="text-sm text-gray-600 mb-4">Choose an amount and fields for your embedded checkout.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="flex items-center gap-2 mb-2">
                <button
                  className={`px-3 py-1 rounded-lg text-sm border ${mode==='usd' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white'}`}
                  onClick={() => setMode('usd')}
                >USD</button>
                <button
                  className={`px-3 py-1 rounded-lg text-sm border ${mode==='sbtc' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white'}`}
                  onClick={() => setMode('sbtc')}
                >sBTC</button>
              </div>
              {mode === 'usd' ? (
                <>
                  <input
                    type="number"
                    step="0.01"
                    value={form.usdAmount}
                    onChange={(e) => setForm({ ...form, usdAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">≈ {derived.sbtc.toFixed(6)} sBTC</div>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    step="0.000001"
                    value={form.sbtcAmount}
                    onChange={(e) => setForm({ ...form, sbtcAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">≈ ${derived.usd.toFixed(2)} USD</div>
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.showEmail}
                  onChange={(e) => setForm({ ...form, showEmail: e.target.checked })}
                />
                Require email
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.showAddress}
                  onChange={(e) => setForm({ ...form, showAddress: e.target.checked })}
                />
                Collect address
              </label>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <PaymentButton
                label="Create & Open (New Tab)"
                variant="primary"
                loading={creating}
                amount={mode === 'usd' ? (derived.usd || 0).toFixed(2) : (derived.sbtc || 0).toFixed(6)}
                currency={mode === 'usd' ? 'USD' : 'sBTC'}
                onClick={() => createPayment(true)}
              />
              <PaymentButton
                label="Create & Open Here"
                variant="outline"
                loading={creating}
                amount={mode === 'usd' ? (derived.usd || 0).toFixed(2) : (derived.sbtc || 0).toFixed(6)}
                currency={mode === 'usd' ? 'USD' : 'sBTC'}
                onClick={() => createPayment(false)}
              />
              <button onClick={copyLink} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50">
                <Copy className="w-4 h-4" /> Copy Last Link
              </button>
              <button onClick={reset} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50">
                <RefreshCw className="w-4 h-4" /> Reset
              </button>
            </div>

            {lastPayment && (
              <div className="mt-3 text-sm text-gray-700">
                Last payment: <code className="font-mono">{lastPayment.id}</code>{' '}
                <a
                  href={`/pay/${lastPayment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Inline Checkout Preview</h2>
          <p className="text-sm text-gray-600 mb-4">This preview collapses and collects fields you select.</p>
          <PaymentCard
            title={form.title}
            description={form.description}
            amount={mode === 'sbtc' ? Number(form.sbtcAmount || 0) : undefined}
            amountUSD={mode === 'usd' ? Number(form.usdAmount || 0) : undefined}
            showEmail={form.showEmail}
            showAddress={form.showAddress}
            onSuccess={async () => {
              await createPayment(true);
            }}
          />

          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-2">Standalone Form (for custom layouts)</h3>
            <CheckoutForm
              amount={mode === 'sbtc' ? Number(form.sbtcAmount || 0) : undefined}
              amountUSD={mode === 'usd' ? Number(form.usdAmount || 0) : undefined}
              showEmail={form.showEmail}
              showAddress={form.showAddress}
              onSubmit={async () => createPayment(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmbeddedCheckout;
