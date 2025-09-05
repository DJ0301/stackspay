import React, { useState, useEffect } from 'react';
import { useConnect } from '@stacks/connect-react';
import { 
  makeContractCall,
  AnchorMode,
  uintCV,
  principalCV,
  cvToHex,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import axios from 'axios';

// Standalone embeddable widget that can be used on any website
export function EmbeddablePaymentWidget({ 
  apiUrl = (import.meta?.env?.VITE_API_URL) || '',
  merchantAddress,
  amount,
  amountUSD,
  description,
  metadata,
  onSuccess,
  onError,
  theme = {},
  showEmail = false,
  allowCustomAmount = false,
  minAmount,
  maxAmount,
  showLogo = true,
  logoUrl,
  buttonText = 'Pay with StacksPay',
  successMessage = '✓ Payment successful!',
  errorMessage = 'Payment failed. Please try again.',
  showPoweredBy = true,
  width = '400px',
  height = 'auto',
  position = 'center'
}) {
  const { doContractCall, userSession, doOpenAuth } = useConnect();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle');
  const [paymentData, setPaymentData] = useState(null);
  const [config, setConfig] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [email, setEmail] = useState('');
  const [btcPrice, setBtcPrice] = useState(0);
  
  const network = new StacksTestnet();
  const SBTC_CONTRACT = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4';
  const SBTC_TOKEN = 'sbtc-token';

  useEffect(() => {
    fetchConfig();
  }, [merchantAddress]);

  const fetchConfig = async () => {
    try {
      const base = apiUrl || ''
      const response = await axios.get(`${base}/api/widget/config`, {
        params: { merchant: merchantAddress }
      });
      setConfig(response.data);
      setBtcPrice(response.data.btcPrice);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const createPayment = async () => {
    try {
      const finalAmount = allowCustomAmount && customAmount ? 
        parseFloat(customAmount) : amount;
      
      const base = apiUrl || ''
      const response = await axios.post(`${base}/api/payments/create`, {
        amount: finalAmount,
        amountUSD,
        description,
        metadata,
        customerEmail: email || null,
        merchantAddress: merchantAddress || config?.merchantAddress
      });
      
      setPaymentData(response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  };

  const normalizeTxId = (tx) => {
    if (!tx || typeof tx !== 'string') return tx;
    return tx.startsWith('0x') ? tx.slice(2) : tx;
  };

  const handlePayment = async () => {
    // Ensure wallet is connected; if not, prompt connect and continue
    if (!userSession || !userSession.isUserSignedIn()) {
      try {
        await new Promise((resolve) => {
          doOpenAuth({
            onFinish: () => resolve(),
            onCancel: () => resolve(),
          });
        });
      } catch (e) {
        // ignore
      }
    }

    if (!userSession || !userSession.isUserSignedIn()) {
      setStatus('error');
      onError?.({ error: 'Please connect your wallet first' });
      return;
    }

    setLoading(true);
    setStatus('processing');

    try {
      const payment = await createPayment();
      const finalAmount = Math.floor(payment.amount * 100_000_000); // Convert to micro-sBTC (1e8)
      
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const [contractAddress, contractName] = config.contract.split('.');
      const merchantPrincipal = payment.merchantAddress || config.merchantAddress;

      const options = {
        network,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: 'pay-to',
        functionArgs: [
          uintCV(BigInt('0x' + payment.id.replace(/-/g, '').slice(0, 16))),
          uintCV(finalAmount),
          principalCV(merchantPrincipal)
        ],
        postConditionMode: 'allow',
        postConditions: [],
        onFinish: async (data) => {
          console.log('Transaction submitted:', data);
          // Keep in processing until backend confirmation completes, mirroring PaymentWidget
          setStatus('processing');
          const rawTx = data?.txId || data?.txid;
          try {
            const base = apiUrl || ''
            await axios.post(`${base}/api/payments/${payment.id}/confirm`, {
              txId: normalizeTxId(rawTx),
              customerAddress: userSession.loadUserData().profile.stxAddress.testnet
            });
            setStatus('success');
          } catch (e) {
            console.error('[DEBUG] Confirm failed (Embeddable, onFinish):', e);
            // stay in processing; host page may poll if desired
          }
          onSuccess?.({
            txId: rawTx,
            paymentId: payment.id,
            amount: payment.amount,
            amountUSD: payment.amountUSD
          });
          setLoading(false);
        },
        onCancel: () => {
          setStatus('idle');
          setLoading(false);
        }
      };

      // Try Leather RPC first if available to ensure postconditions are disabled explicitly
      const provider = window?.LeatherProvider || window?.leather || window?.Leather || window?.XverseProviders?.standard || null;
      if (provider?.request) {
        try {
          const argsHex = [
            cvToHex(options.functionArgs[0]),
            cvToHex(options.functionArgs[1]),
            cvToHex(options.functionArgs[2]),
          ];
          console.log('[DEBUG] Embeddable Leather RPC stx_callContract with allow mode');
          const resp = await provider.request('stx_callContract', {
            contract: `${contractAddress}.${contractName}`,
            functionName: 'pay-to',
            functionArgs: argsHex,
            postConditionMode: 'allow',
            postConditions: [],
          });
          const txId = resp?.result?.txid || resp?.txid || resp?.result?.txId || resp?.txId;
          if (txId) {
            setStatus('processing');
            try {
              const base = apiUrl || ''
              await axios.post(`${base}/api/payments/${payment.id}/confirm`, {
                txId: normalizeTxId(txId),
                customerAddress: userSession.loadUserData().profile.stxAddress.testnet
              });
              setStatus('success');
            } catch (e) {
              console.error('[DEBUG] Confirm failed (Embeddable, RPC):', e);
            }
            onSuccess?.({ txId, paymentId: payment.id, amount: payment.amount, amountUSD: payment.amountUSD });
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('[DEBUG] Leather RPC path failed in Embeddable, falling back to doContractCall', e);
        }
        // Try object-form request fallback like PaymentWidget
        try {
          const argsHex2 = [
            cvToHex(options.functionArgs[0]),
            cvToHex(options.functionArgs[1]),
            cvToHex(options.functionArgs[2]),
          ];
          const resp2 = await provider.request({
            method: 'stx_callContract',
            params: {
              contract: `${contractAddress}.${contractName}`,
              functionName: 'pay-to',
              functionArgs: argsHex2,
              postConditionMode: 'allow',
              postConditions: [],
            }
          });
          const txId2 = resp2?.result?.txid || resp2?.txid || resp2?.result?.txId || resp2?.txId;
          if (txId2) {
            setStatus('processing');
            try {
              const base = apiUrl || ''
              await axios.post(`${base}/api/payments/${payment.id}/confirm`, {
                txId: normalizeTxId(txId2),
                customerAddress: userSession.loadUserData().profile.stxAddress.testnet
              });
              setStatus('success');
            } catch (e2) {
              console.error('[DEBUG] Confirm failed (Embeddable, RPC object-form):', e2);
            }
            onSuccess?.({ txId: txId2, paymentId: payment.id, amount: payment.amount, amountUSD: payment.amountUSD });
            setLoading(false);
            return;
          }
        } catch (e2) {
          console.log('[DEBUG] Leather RPC object-form failed in Embeddable, falling back to doContractCall', e2);
        }
      }

      console.log('[DEBUG] Embeddable doContractCall options:', {
        postConditionMode: options.postConditionMode,
        hasPostConditions: Array.isArray(options.postConditions) ? options.postConditions.length : 'undefined'
      });
      await doContractCall(options);
    } catch (error) {
      console.error('Payment error:', error);
      setStatus('error');
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  const defaultTheme = {
    primaryColor: theme.primaryColor || '#7C3AED',
    secondaryColor: theme.secondaryColor || '#6B7280',
    backgroundColor: theme.backgroundColor || '#FFFFFF',
    textColor: theme.textColor || '#111827',
    borderColor: theme.borderColor || '#E5E7EB',
    fontFamily: theme.fontFamily || 'Inter, system-ui, sans-serif',
    fontSize: theme.fontSize || '16px',
    borderRadius: theme.borderRadius || '8px',
    borderWidth: theme.borderWidth || '1px',
    padding: theme.padding || '20px',
    shadow: theme.shadow || '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    ...theme
  };

  const containerStyle = {
    fontFamily: defaultTheme.fontFamily,
    maxWidth: width,
    width: '100%',
    margin: position === 'center' ? '0 auto' : position === 'left' ? '0 auto 0 0' : '0 0 0 auto',
    padding: defaultTheme.padding,
    border: `${defaultTheme.borderWidth} solid ${defaultTheme.borderColor}`,
    borderRadius: defaultTheme.borderRadius,
    backgroundColor: defaultTheme.backgroundColor,
    boxShadow: defaultTheme.shadow,
    fontSize: defaultTheme.fontSize,
    color: defaultTheme.textColor,
    height: height !== 'auto' ? height : 'auto'
  };

  return (
    <div style={containerStyle}>
      {showLogo && ((logoUrl || '/logo.png') || description) && (
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${defaultTheme.borderColor}`
        }}>
          {(logoUrl || '/logo.png') && (
            <img 
              src={logoUrl || '/logo.png'} 
              alt="Logo" 
              style={{
                maxHeight: '60px',
                maxWidth: '200px',
                marginBottom: '8px'
              }}
            />
          )}
          {description && (
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: defaultTheme.textColor,
              marginTop: (logoUrl || '/logo.png') ? '8px' : '0'
            }}>
              {description}
            </div>
          )}
        </div>
      )}
      {!showLogo && (
        <h3 style={{ 
          marginTop: 0, 
          color: defaultTheme.textColor,
          fontSize: '20px',
          fontWeight: '600',
          marginBottom: '16px'
        }}>
          {description || 'Complete Payment'}
        </h3>
      )}

      {allowCustomAmount && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '4px',
            fontSize: '14px',
            fontWeight: '500',
            color: defaultTheme.secondaryColor
          }}>
            Amount (sBTC)
          </label>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            min={minAmount}
            max={maxAmount}
            step="0.00001"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${defaultTheme.borderColor}`,
              borderRadius: defaultTheme.borderRadius,
              fontSize: defaultTheme.fontSize,
              backgroundColor: defaultTheme.backgroundColor,
              color: defaultTheme.textColor,
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            placeholder="0.00000000"
          />
          {btcPrice > 0 && customAmount && (
            <div style={{ 
              marginTop: '4px',
              fontSize: '12px',
              color: defaultTheme.secondaryColor
            }}>
              ≈ ${(parseFloat(customAmount) * btcPrice).toFixed(2)} USD
            </div>
          )}
        </div>
      )}

      {!allowCustomAmount && (
        <div style={{
          padding: '16px',
          backgroundColor: theme.amountBackgroundColor || '#F9FAFB',
          borderRadius: defaultTheme.borderRadius,
          marginBottom: '16px',
          border: `1px solid ${theme.amountBorderColor || defaultTheme.borderColor}`
        }}>
          <div style={{ 
            fontSize: theme.amountFontSize || '24px', 
            fontWeight: 'bold', 
            color: theme.amountTextColor || defaultTheme.textColor 
          }}>
            {amount ? `${amount} sBTC` : `$${amountUSD} USD`}
          </div>
          {btcPrice > 0 && (
            <div style={{ 
              fontSize: '14px', 
              color: defaultTheme.secondaryColor, 
              marginTop: '4px' 
            }}>
              {amount ? 
                `≈ $${(amount * btcPrice).toFixed(2)} USD` :
                `≈ ${(amountUSD / btcPrice).toFixed(8)} sBTC`
              }
            </div>
          )}
        </div>
      )}

      {showEmail && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '4px',
            fontSize: '14px',
            fontWeight: '500',
            color: defaultTheme.secondaryColor
          }}>
            Email (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${defaultTheme.borderColor}`,
              borderRadius: defaultTheme.borderRadius,
              fontSize: defaultTheme.fontSize,
              backgroundColor: defaultTheme.backgroundColor,
              color: defaultTheme.textColor,
              outline: 'none'
            }}
            placeholder="your@email.com"
          />
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={loading || (allowCustomAmount && !customAmount)}
        style={{
          width: '100%',
          padding: theme.buttonPadding || '12px 24px',
          backgroundColor: loading ? '#9CA3AF' : defaultTheme.primaryColor,
          color: theme.buttonTextColor || '#FFFFFF',
          border: theme.buttonBorder || 'none',
          borderRadius: defaultTheme.borderRadius,
          fontSize: theme.buttonFontSize || defaultTheme.fontSize,
          fontWeight: theme.buttonFontWeight || '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          boxShadow: theme.buttonShadow || 'none',
          textTransform: theme.buttonTextTransform || 'none'
        }}
      >
        {loading ? (theme.loadingText || 'Processing...') : buttonText}
      </button>

      {status === 'success' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: theme.successBackgroundColor || '#D1FAE5',
          color: theme.successTextColor || '#065F46',
          borderRadius: defaultTheme.borderRadius,
          fontSize: '14px',
          border: theme.successBorder || 'none'
        }}>
          {successMessage}
        </div>
      )}

      {status === 'error' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: theme.errorBackgroundColor || '#FEE2E2',
          color: theme.errorTextColor || '#991B1B',
          borderRadius: defaultTheme.borderRadius,
          fontSize: '14px',
          border: theme.errorBorder || 'none'
        }}>
          {errorMessage}
        </div>
      )}

      {showPoweredBy && (
        <div style={{
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: theme.poweredByColor || '#9CA3AF'
        }}>
          {theme.poweredByText || 'Powered by StacksPay'}
        </div>
      )}
    </div>
  );
}

// Widget loader script for external websites
export const WidgetLoader = `
(function() {
  window.StacksPayWidget = {
    init: function(config) {
      const script = document.createElement('script');
      // Resolve base URL at runtime (no process.env in browser)
      var base = (config && config.widgetBaseUrl)
        || (typeof window !== 'undefined' && (window.__STACKSPAY_WIDGET_BASE__ || window.__SBTC_WIDGET_BASE__))
        || (typeof location !== 'undefined' ? location.origin : '');
      if (!base) {
        base = 'http://localhost:3000';
      }
      script.src = base.replace(/\/$/, '') + '/widget.js';
      script.async = true;
      script.onload = function() {
        if (window.renderStacksPayWidget) {
          window.renderStacksPayWidget(config);
        } else if (window.renderSBTCWidget) {
          window.renderSBTCWidget(config);
        }
      };
      document.head.appendChild(script);
    }
  };
  // Backward compatibility alias
  window.SBTCPaymentWidget = window.SBTCPaymentWidget || {
    init: function(config) { window.StacksPayWidget.init(config); }
  };
})();
`;
