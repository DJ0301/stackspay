import React from 'react';

function Code({ children }) {
  return (
    <pre className="bg-gray-900/95 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto border border-white/10"><code>{children}</code></pre>
  );
}

function Docs() {
  const sections = [
    { id: 'quickstart', label: 'Quickstart' },
    { id: 'overview', label: 'Overview' },
    { id: 'auth', label: 'Authentication' },
    { id: 'endpoints', label: 'Endpoints' },
    { id: 'payments-api', label: 'Payments API' },
    { id: 'hosted-checkout', label: 'Hosted Checkout' },
    { id: 'widget', label: 'Embeddable Widget' },
    { id: 'payment-links', label: 'Payment Links' },
    { id: 'webhooks', label: 'Webhooks' },
    { id: 'errors', label: 'Errors' },
    { id: 'env', label: 'Environment' }
  ]

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-black/30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="StacksPay" className="w-7 h-7 rounded" />
            <span className="font-semibold">StacksPay Docs</span>
          </div>
          <div className="hidden md:block w-80">
            <input
              placeholder="Search (coming soon)"
              className="w-full px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </div>
      </header>

      {/* Main two-column layout */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block">
          <nav className="sticky top-16 space-y-2 text-sm">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-3 py-2 rounded-md text-white/80 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="space-y-8">
          <div className="mb-2">
            <h1 className="text-3xl font-black">Developer Documentation</h1>
            <p className="text-white/70 mt-2">Integrate payments with StacksPay via REST APIs, hosted checkout, and webhooks.</p>
          </div>

          {/* Quickstart */}
          <section id="quickstart" className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-white">Quickstart</h2>
            <p className="text-sm text-white/80">Create a payment in USD and redirect your buyer to hosted checkout:</p>
            <p className="text-xs text-white/60">Note: replace <code>$API_BASE</code> with your backend base URL (e.g. the deployed API URL). If your frontend and backend share the same origin, you can use relative paths like <code>/api/...</code>.</p>
            <Code>{`# 1) Create a payment (server-side)
curl -X POST "$API_BASE/api/payments/create" \
  -H 'Content-Type: application/json' \
  -d '{
    "amountUSD": 10,
    "metadata": { "orderId": "123", "checkoutType": "simple" }
  }'

# 2) Redirect user to hosted checkout (frontend)
// GET /pay/:paymentId on the frontend app
window.location.href = "/pay/" + paymentId;`}</Code>
            <p className="text-xs text-white/60">Tip: You can pass <code>amount</code> (sBTC) instead of <code>amountUSD</code> if you already price in sBTC.</p>
          </section>

          {/* Overview */}
          <section id="overview" className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-2">Overview</h2>
            <p className="text-sm text-white/80">All amounts are denominated in sBTC. You can pass either <code>amount</code> (sBTC) or <code>amountUSD</code>; the server converts using a BTC/USD price feed.</p>
          </section>

          {/* Authentication */}
          <section id="auth" className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-2">Authentication</h2>
            <p className="text-sm text-white/80 mb-3">Use your Dashboard to obtain a JWT. Send it as a Bearer token for merchant-protected endpoints.</p>
            <Code>{`GET /api/merchant/payments
Authorization: Bearer <JWT>`}</Code>
          </section>

          {/* Endpoints */}
          <section id="endpoints" className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-white">Endpoints</h2>
            <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
              <li><code>POST /api/payments/create</code> — create a pending payment (accepts <code>amount</code> in sBTC or <code>amountUSD</code>).</li>
              <li><code>GET /api/payments/:id</code> — retrieve a payment by id.</li>
              <li><code>POST /api/payments/:id/confirm</code> — attach a txId and start on-chain confirmation monitoring.</li>
              <li><code>GET /api/merchant/payments</code> — list recent payments (JWT required).</li>
              <li><code>GET /api/widget/config</code> — retrieve widget configuration and price data.</li>
            </ul>
            <Code>{`# Retrieve payment
curl "$API_BASE/api/payments/pay_abc123"

# Merchant payments (requires JWT)
curl -H "Authorization: Bearer <JWT>" \
  "$API_BASE/api/merchant/payments?limit=10"`}</Code>
          </section>

          {/* Payments API */}
          <section id="payments-api" className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-white">Payments API</h2>
            <div>
              <h3 className="font-medium text-white">Create a payment</h3>
              <p className="text-sm text-white/80">Creates a pending payment and returns an ID for hosted checkout.</p>
              <Code>{`POST /api/payments/create
Content-Type: application/json

{
  "amountUSD": 10,
  "metadata": { "orderId": "123" }
}

// 200 OK
{
  "id": "pay_abc123",
  "amount": 0.00015,      // sBTC
  "amountUSD": 10,
  "status": "pending",
  "expiresAt": "2025-09-01T12:00:00.000Z"
}`}</Code>
            </div>
            <div>
              <h3 className="font-medium text-white">Retrieve a payment</h3>
              <Code>{`GET /api/payments/:id

// 200 OK (document returned directly)
{
  "id": "pay_abc123",
  "amount": 0.00015,
  "amountUSD": 10,
  "status": "pending"
}`}</Code>
            </div>
            <div>
              <h3 className="font-medium text-white">Confirm payment on-chain</h3>
              <p className="text-sm text-white/80">The hosted page handles this via the sBTC contract. If calling manually:</p>
              <Code>{`POST /api/payments/:id/confirm
Content-Type: application/json

{ "txId": "0x..." }

// 200 OK
{ "status": "processing" }`}</Code>
            </div>
          </section>

          {/* Hosted Checkout */}
          <section id="hosted-checkout" className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-white">Hosted Checkout</h2>
            <p className="text-sm text-white/80">After creating a payment, redirect users to <code>/pay/:paymentId</code> on this app. The page guides them through paying with sBTC and will update status automatically.</p>
            <Code>{`// Example: in your frontend
const res = await fetch('/api/payments/create', { method: 'POST', body: JSON.stringify({ amountUSD: 10 }) });
const { id } = await res.json();
window.location.href = "/pay/" + id;`}</Code>
          </section>

          {/* Embeddable Widget */}
          <section id="widget" className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-white">Embeddable Widget</h2>
            <p className="text-sm text-white/80">Embed the widget in your site to accept sBTC payments inline. See <code>/widget</code> route and <code>PaymentWidget</code> component for reference.</p>
            <Code>{`<!-- Basic iframe embed -->
<iframe
  src="/widget?amountUSD=10&metadata[orderId]=123"
  style="width: 100%; height: 520px; border: 0; border-radius: 8px;"
  allow="payment"
></iframe>`}</Code>
          </section>

          {/* Payment Links */}
          <section id="payment-links" className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-white">Payment Links</h2>
            <p className="text-sm text-white/80">Create links for one-off or product payments. Manage in Dashboard → Payment Links.</p>
            <Code>{`GET /api/payment-links (auth required)
Authorization: Bearer <JWT>`}</Code>
          </section>

          {/* Webhooks */}
          <section id="webhooks" className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-white">Webhooks</h2>
            <p className="text-sm text-white/80">Subscribe to events and verify signatures using your endpoint's secret.</p>
            <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
              <li><code>payment.completed</code> — payment confirmed on-chain</li>
              <li><code>payment.failed</code> — payment expired or failed</li>
              <li><code>payment.pending</code> — created and awaiting confirmation</li>
            </ul>
            <Code>{`POST https://yourapp.com/webhooks
Headers:
  Stripe-Signature: t=...,v1=... // (example header format; verify using your secret)

Body:
{
  "id": "evt_123",
  "type": "payment.completed",
  "data": { "paymentId": "pay_abc123" }
}`}</Code>
            <div>
              <h3 className="font-medium text-white">Verify signature (Node/Express)</h3>
              <Code>{`import crypto from 'crypto';

app.post('/webhooks', express.json({ type: 'application/json' }), (req, res) => {
  const payload = JSON.stringify(req.body);
  const sig = req.get('X-Webhook-Signature');
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  if (sig !== expected) return res.status(400).send('Invalid signature');
  // handle event
  res.json({ received: true });
});`}</Code>
            </div>
          </section>

          {/* Errors */}
          <section id="errors" className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-2">Errors</h2>
            <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
              <li>400 — missing or invalid parameters</li>
              <li>401 — invalid/expired token</li>
              <li>404 — resource not found</li>
              <li>500 — unexpected server error</li>
            </ul>
          </section>

          {/* Environment */}
          <section id="env" className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-2">Environment & Config</h2>
            <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
              <li><code>NETWORK</code> — <code>testnet</code> or <code>mainnet</code></li>
              <li><code>CONTRACT_ADDRESS</code> and <code>CONTRACT_NAME</code> — sBTC contract identifiers</li>
              <li><code>JWT_SECRET</code> — used to sign dashboard tokens</li>
              <li><code>WEBHOOK_SECRET</code> — used to sign outgoing webhooks</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Docs;
