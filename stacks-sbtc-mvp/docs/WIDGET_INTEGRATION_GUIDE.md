# sBTC Payment Widget Integration Guide

## Overview

The sBTC Payment Gateway provides multiple ways to integrate payments into your website or application:

1. **Embeddable Widget** - Drop-in payment form
2. **Payment Links** - Shareable payment URLs
3. **Checkout Elements** - Customizable UI components
4. **Direct API** - Full control integration

---

## Quick Start

### 1. Embeddable Widget

The simplest way to accept sBTC payments on your website.

#### Basic Integration

Add this code to your HTML:

```html
<!-- Add to your HTML head -->
<script src="https://pay.your-domain.com/widget.js"></script>

<!-- Add where you want the payment widget -->
<div id="sbtc-payment"></div>

<script>
  SBTCPaymentWidget.init({
    container: 'sbtc-payment',
    merchantAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    amount: 0.001,
    description: 'Premium Subscription',
    onSuccess: function(result) {
      console.log('Payment successful:', result.txId);
      // Redirect or show success message
    },
    onError: function(error) {
      console.error('Payment failed:', error);
      // Handle error
    }
  });
</script>
```

#### Advanced Configuration

```javascript
SBTCPaymentWidget.init({
  // Required
  container: 'sbtc-payment',
  merchantAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  
  // Payment amount (use either amount or amountUSD)
  amount: 0.001,           // in sBTC
  amountUSD: 100,          // in USD (will be converted)
  
  // Optional configurations
  description: 'Product Name',
  allowCustomAmount: true,  // Let users enter custom amount
  minAmount: 0.0001,       // Minimum allowed amount
  maxAmount: 1,            // Maximum allowed amount
  showEmail: true,         // Collect customer email
  
  // Metadata (custom data)
  metadata: {
    orderId: '12345',
    customerId: 'cust_abc',
    productId: 'prod_xyz'
  },
  
  // Callbacks
  onSuccess: function(result) {
    // result.txId - Transaction ID
    // result.paymentId - Payment ID
    // result.amount - Amount paid
  },
  onError: function(error) {
    // Handle error
  },
  
  // Styling
  theme: {
    primaryColor: '#7C3AED',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '8px'
  }
});
```

---

### 2. React Integration

For React applications, use the component directly:

```jsx
import { EmbeddablePaymentWidget } from '@sbtc/payment-widget';

function CheckoutPage() {
  const handleSuccess = (result) => {
    console.log('Payment successful:', result);
    // Navigate to success page
  };

  const handleError = (error) => {
    console.error('Payment failed:', error);
    // Show error message
  };

  return (
    <EmbeddablePaymentWidget
      merchantAddress="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      amount={0.001}
      description="Premium Subscription"
      onSuccess={handleSuccess}
      onError={handleError}
      showEmail={true}
      theme={{
        primaryColor: '#6366f1'
      }}
    />
  );
}
```

---

### 3. Payment Links

Create reusable payment links via API or dashboard.

#### Creating a Payment Link

```javascript
const response = await fetch('https://api.your-domain.com/api/payment-links', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Premium Subscription',
    amount: 0.001,
    description: 'Monthly premium features',
    successUrl: 'https://yoursite.com/success',
    webhookUrl: 'https://yoursite.com/webhook'
  })
});

const paymentLink = await response.json();
console.log('Payment link:', paymentLink.link);
// https://pay.your-domain.com/pay/xyz789
```

#### Embedding Payment Link as Button

```html
<a href="https://pay.your-domain.com/pay/xyz789" 
   class="sbtc-payment-button"
   data-amount="0.001"
   data-description="Premium Subscription">
  Pay with sBTC
</a>

<script src="https://pay.your-domain.com/button.js"></script>
```

---

### 4. Checkout Elements

Use pre-built UI components for custom integration:

```javascript
import { 
  PaymentButton, 
  CheckoutForm, 
  PaymentStatus 
} from '@sbtc/checkout-elements';

function CustomCheckout() {
  const [status, setStatus] = useState('idle');
  
  const handlePayment = async (formData) => {
    setStatus('processing');
    
    try {
      // Create payment
      const payment = await createPayment({
        amount: 0.001,
        ...formData
      });
      
      // Process with Stacks wallet
      const result = await processPayment(payment.id);
      
      setStatus('success');
    } catch (error) {
      setStatus('failed');
    }
  };
  
  return (
    <div>
      {status === 'idle' && (
        <CheckoutForm
          amount={0.001}
          amountUSD={100}
          onSubmit={handlePayment}
          showEmail={true}
          showAddress={false}
        />
      )}
      
      {status !== 'idle' && (
        <PaymentStatus 
          status={status}
          amount={0.001}
        />
      )}
    </div>
  );
}
```

---

## Webhook Integration

Set up webhooks to receive payment notifications:

```javascript
// Express.js webhook handler
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  switch(event.event) {
    case 'payment.completed':
      // Handle successful payment
      console.log('Payment completed:', event.data);
      // Update order status, send email, etc.
      break;
      
    case 'payment.failed':
      // Handle failed payment
      console.log('Payment failed:', event.data);
      break;
  }
  
  res.json({ received: true });
});
```

---

## Mobile Integration

### iOS (Swift)

```swift
import WebKit

class PaymentViewController: UIViewController {
    @IBOutlet weak var webView: WKWebView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let paymentHTML = """
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://pay.your-domain.com/widget.js"></script>
        </head>
        <body>
            <div id="payment"></div>
            <script>
                SBTCPaymentWidget.init({
                    container: 'payment',
                    merchantAddress: 'ST1...',
                    amount: 0.001,
                    onSuccess: function(result) {
                        window.webkit.messageHandlers.payment.postMessage({
                            status: 'success',
                            txId: result.txId
                        });
                    }
                });
            </script>
        </body>
        </html>
        """
        
        webView.loadHTMLString(paymentHTML, baseURL: nil)
    }
}
```

### Android (Kotlin)

```kotlin
class PaymentActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_payment)
        
        webView = findViewById(R.id.webView)
        webView.settings.javaScriptEnabled = true
        
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun onPaymentSuccess(txId: String) {
                runOnUiThread {
                    // Handle success
                    finish()
                }
            }
        }, "Android")
        
        val html = """
        <html>
        <head>
            <script src="https://pay.your-domain.com/widget.js"></script>
        </head>
        <body>
            <div id="payment"></div>
            <script>
                SBTCPaymentWidget.init({
                    container: 'payment',
                    merchantAddress: 'ST1...',
                    amount: 0.001,
                    onSuccess: function(result) {
                        Android.onPaymentSuccess(result.txId);
                    }
                });
            </script>
        </body>
        </html>
        """
        
        webView.loadData(html, "text/html", "UTF-8")
    }
}
```

---

## Customization

### Custom Themes

```javascript
SBTCPaymentWidget.init({
  // ... other config
  theme: {
    // Colors
    primaryColor: '#7C3AED',
    secondaryColor: '#F3F4F6',
    errorColor: '#EF4444',
    successColor: '#10B981',
    
    // Typography
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '16px',
    
    // Borders and spacing
    borderRadius: '8px',
    borderColor: '#E5E7EB',
    padding: '20px',
    
    // Shadows
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    
    // Custom CSS
    customCSS: `
      .payment-widget {
        max-width: 400px;
      }
      .payment-button:hover {
        transform: translateY(-2px);
      }
    `
  }
});
```

### Language Support

```javascript
SBTCPaymentWidget.init({
  // ... other config
  language: 'es', // Spanish
  translations: {
    payButton: 'Pagar con sBTC',
    amount: 'Cantidad',
    email: 'Correo electrónico',
    processing: 'Procesando...',
    success: '¡Pago exitoso!',
    error: 'Error en el pago'
  }
});
```

---

## Security Best Practices

1. **Always verify webhooks**: Check signatures to ensure webhooks are from our servers
2. **Use HTTPS**: Always use HTTPS in production
3. **Validate amounts**: Verify payment amounts on your server
4. **Store secrets securely**: Never expose API keys or webhook secrets in client code
5. **Implement rate limiting**: Protect against abuse
6. **Monitor transactions**: Set up alerts for unusual activity

---

## Testing

### Test Card/Wallet

Use these test credentials on testnet:

```
Test Wallet: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
Test sBTC Amount: 0.00001
```

### Test Payment Links

```
https://pay.your-domain.com/test
```

### Sandbox Mode

```javascript
SBTCPaymentWidget.init({
  // ... other config
  sandbox: true, // Enable sandbox mode
  testnet: true  // Use testnet
});
```

---

## Troubleshooting

### Common Issues

**Widget not loading**
- Check if script URL is correct
- Verify merchant address is valid
- Check browser console for errors

**Payment failing**
- Ensure user has sufficient sBTC balance
- Verify network (mainnet vs testnet)
- Check contract deployment status

**Webhook not received**
- Verify webhook URL is publicly accessible
- Check webhook secret matches
- Review webhook logs in dashboard

### Debug Mode

```javascript
SBTCPaymentWidget.init({
  // ... other config
  debug: true, // Enable debug logging
  onDebug: function(log) {
    console.log('Debug:', log);
  }
});
```

---

## Support Resources

- **Documentation**: https://docs.your-domain.com
- **API Reference**: https://api.your-domain.com/docs
- **Example Code**: https://github.com/your-org/sbtc-examples
- **Dashboard**: https://dashboard.your-domain.com
- **Support Email**: support@your-domain.com
- **Discord**: https://discord.gg/your-community

---

## Migration Guide

### From v1 to v2

```javascript
// Old (v1)
PaymentWidget.create({
  merchant: 'address',
  amount: 100 // in USD cents
});

// New (v2)
SBTCPaymentWidget.init({
  merchantAddress: 'address',
  amountUSD: 100 // in USD dollars
});
```

---

## Changelog

### v2.0.0 (Current)
- Added multi-merchant support
- Introduced payment links
- Added subscription management
- Improved webhook system
- Enhanced security features

### v1.0.0
- Initial release
- Basic payment widget
- Single merchant support
