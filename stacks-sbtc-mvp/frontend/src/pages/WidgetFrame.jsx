import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { EmbeddablePaymentWidget } from '../components/EmbeddableWidget';

function useAutoResize() {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.ceil(entry.contentRect.height);
        try {
          window.parent.postMessage({ type: 'sbtc-widget-size', height }, '*');
          window.parent.postMessage({ type: 'stackspay-widget-size', height }, '*');
        } catch {}
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ref;
}

function parseConfig() {
  const sp = new URLSearchParams(window.location.search);
  const c = sp.get('c');
  if (!c) return {};
  try {
    return JSON.parse(decodeURIComponent(c));
  } catch {
    return {};
  }
}

export default function WidgetFrame() {
  const initialConfig = useMemo(parseConfig, []);
  const [resolved, setResolved] = useState({ ready: false, config: initialConfig, error: null });
  const wrapperRef = useAutoResize();

  useEffect(() => {
    try { document.body.style.background = 'transparent'; } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      // If linkId provided, attempt to fetch link details
      const linkId = initialConfig.linkId;
      if (!linkId) {
        setResolved({ ready: true, config: initialConfig, error: null });
        return;
      }
      try {
        const envBase = (import.meta?.env?.VITE_API_URL) || '';
        const baseApi = initialConfig.apiUrl || envBase;
        const { data } = await axios.get(`${baseApi}/api/payment-links/${linkId}`);
        // Expect shape: { id, description, amount, allowCustomAmount, minAmount, maxAmount, ... }
        const merged = {
          ...initialConfig,
          description: initialConfig.description ?? data?.description,
          amount: initialConfig.amount ?? (data?.amount ?? undefined),
          amountUSD: initialConfig.amountUSD ?? (data?.amountUSD ?? undefined),
          allowCustomAmount: initialConfig.allowCustomAmount ?? !!data?.allowCustomAmount,
          minAmount: initialConfig.minAmount ?? (data?.minAmount ?? undefined),
          maxAmount: initialConfig.maxAmount ?? (data?.maxAmount ?? undefined),
          metadata: { ...(data?.metadata || {}), ...(initialConfig.metadata || {}), linkId },
        };
        if (!cancelled) setResolved({ ready: true, config: merged, error: null });
      } catch (e) {
        // Fall back to initial config and include linkId in metadata so backend can log association
        const fallback = { ...initialConfig, metadata: { ...(initialConfig.metadata || {}), linkId: initialConfig.linkId } };
        if (!cancelled) setResolved({ ready: true, config: fallback, error: e });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [initialConfig]);

  if (!resolved.ready) {
    return <div ref={wrapperRef} style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#6B7280', background: 'transparent' }}>Loading widget…</div>;
  }

  const cfg = resolved.config;

  return (
    <div ref={wrapperRef} style={{ padding: 0, margin: 0, background: 'transparent' }}>
      <EmbeddablePaymentWidget
        apiUrl={cfg.apiUrl || (import.meta?.env?.VITE_API_URL || '')}
        merchantAddress={cfg.merchantAddress}
        amount={cfg.amount}
        amountUSD={cfg.amountUSD}
        description={cfg.description}
        metadata={cfg.metadata}
        onSuccess={cfg.onSuccess}
        onError={cfg.onError}
        theme={cfg.theme || {}}
        showEmail={!!cfg.showEmail}
        allowCustomAmount={!!cfg.allowCustomAmount}
        minAmount={cfg.minAmount}
        maxAmount={cfg.maxAmount}
        showLogo={cfg.showLogo !== false}
        logoUrl={cfg.logoUrl}
        buttonText={cfg.buttonText || 'Pay with StacksPay'}
        successMessage={cfg.successMessage || '✓ Payment successful!'}
        errorMessage={cfg.errorMessage || 'Payment failed. Please try again.'}
        showPoweredBy={cfg.showPoweredBy !== false}
        width={cfg.width || '400px'}
        height={cfg.height || 'auto'}
        position={cfg.position || 'center'}
      />
    </div>
  );
}
