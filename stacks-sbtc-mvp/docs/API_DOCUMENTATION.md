# sBTC Payment Gateway API Documentation

## Base URL
```
https://api.your-domain.com
```

## Authentication

Most merchant endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

To obtain a token, use the authentication endpoint.

---

## Endpoints

### Authentication

#### POST `/api/auth/login`
Authenticate merchant and receive JWT token.

**Request Body:**
```json
{
  "address": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  "signature": "signature_of_message"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "merchantAddress": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
}
```

---

### Health & Configuration

#### GET `/api/health`
Get system health status and configuration.

**Response:**
```json
{
  "status": "ok",
  "network": "testnet",
  "contractAddress": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  "contractName": "sbtc-payment-gateway",
  "merchantAddress": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  "merchantBalance": "1000000",
  "btcPrice": 100000,
  "version": "1.0.0"
}
```

#### GET `/api/widget/config`
Get widget configuration for embedding.

**Query Parameters:**
- `merchant` (optional): Merchant address

**Response:**
```json
{
  "merchantAddress": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  "contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-payment-gateway",
  "network": "testnet",
  "btcPrice": 100000,
  "features": {
    "customAmount": true,
    "email": true,
    "metadata": true
  }
}
```

---

### Payments

#### POST `/api/payments/create`
Create a new payment request.

**Request Body:**
```json
{
  "amount": 0.001,
  "amountUSD": 100,
  "description": "Premium subscription",
  "metadata": {
    "orderId": "12345",
    "customField": "value"
  },
  "customerEmail": "customer@example.com",
  "merchantAddress": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
}
```

**Response:**
```json
{
  "id": "pay_1234567890_abc123",
  "amount": 0.001,
  "amountUSD": 100,
  "description": "Premium subscription",
  "metadata": {},
  "status": "pending",
  "merchantAddress": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET `/api/payments/:paymentId`
Get payment details by ID.

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay_1234567890_abc123",
    "amount": 0.001,
    "amountUSD": 100,
    "status": "completed",
    "txId": "0x123...",
    "payer": "ST2...",
    "recipient": "ST1...",
    "createdAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T00:05:00Z"
  }
}
```

#### POST `/api/payments/:paymentId/confirm`
Confirm a payment after blockchain transaction.

**Request Body:**
```json
{
  "txId": "0x123abc...",
  "customerAddress": "ST2..."
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay_1234567890_abc123",
    "status": "completed",
    "txId": "0x123abc...",
    "confirmedAt": "2024-01-01T00:05:00Z"
  }
}
```

#### GET `/api/payments`
Get all payments (requires authentication).

**Query Parameters:**
- `page` (default: 1): Page number
- `limit` (default: 20): Items per page
- `status`: Filter by status (pending, completed, failed)

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "1",
      "amount": 0.001,
      "status": "completed",
      "txId": "0x123...",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pages": 5
  }
}
```

---

### Payment Links

#### POST `/api/payment-links`
Create a reusable payment link (requires authentication).

**Request Body:**
```json
{
  "name": "Premium Subscription",
  "description": "Monthly premium features",
  "amount": 0.001,
  "amountUSD": 100,
  "allowCustomAmount": false,
  "minAmount": 0.0001,
  "maxAmount": 1,
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel",
  "webhookUrl": "https://example.com/webhook",
  "metadata": {},
  "usageLimit": 100,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "link_abc123",
  "shortCode": "xyz789",
  "name": "Premium Subscription",
  "amount": 0.001,
  "link": "https://pay.your-domain.com/pay/xyz789",
  "isActive": true,
  "usageCount": 0,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET `/api/payment-links`
Get all payment links for merchant (requires authentication).

**Response:**
```json
[
  {
    "id": "link_abc123",
    "name": "Premium Subscription",
    "amount": 0.001,
    "isActive": true,
    "usageCount": 5,
    "usageLimit": 100,
    "link": "https://pay.your-domain.com/pay/xyz789"
  }
]
```

#### PUT `/api/payment-links/:id`
Update payment link (requires authentication).

**Request Body:**
```json
{
  "isActive": false,
  "name": "Updated Subscription"
}
```

#### DELETE `/api/payment-links/:id`
Delete payment link (requires authentication).

#### GET `/api/pay/:shortCode`
Get payment link details by short code (public).

**Response:**
```json
{
  "name": "Premium Subscription",
  "description": "Monthly premium features",
  "amount": 0.001,
  "amountUSD": 100,
  "allowCustomAmount": false,
  "metadata": {}
}
```

#### POST `/api/pay/:shortCode/process`
Process payment through link.

**Request Body:**
```json
{
  "amount": 0.001,
  "customerEmail": "customer@example.com",
  "customerAddress": "ST2...",
  "txId": "0x123..."
}
```

---

### Subscriptions

#### POST `/api/subscriptions/create`
Create a recurring subscription.

**Request Body:**
```json
{
  "amount": 0.001,
  "amountUSD": 100,
  "interval": "monthly",
  "metadata": {
    "plan": "premium"
  },
  "recipient": "ST1..."
}
```

**Response:**
```json
{
  "success": true,
  "subscriptionId": "sub_123",
  "amount": 0.001,
  "interval": "monthly",
  "nextPaymentDate": "2024-02-01T00:00:00Z",
  "paymentLink": "https://pay.your-domain.com/subscribe/sub_123"
}
```

#### POST `/api/subscriptions/:subscriptionId/cancel`
Cancel an active subscription.

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled"
}
```

---

### Merchant Statistics

#### GET `/api/merchant/stats`
Get merchant statistics (requires authentication).

**Response:**
```json
{
  "merchantAddress": "ST1...",
  "balance": "0.12345678",
  "totalPayments": 150,
  "totalVolume": "1.23456789",
  "currency": "sBTC",
  "btcPrice": 100000
}
```

---

## Webhooks

When a payment is completed, a webhook will be sent to the configured URL:

**Webhook Payload:**
```json
{
  "event": "payment.completed",
  "data": {
    "id": "pay_123",
    "amount": 0.001,
    "txId": "0x123...",
    "status": "completed"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Webhook Headers:**
```
Content-Type: application/json
X-Webhook-Signature: sha256_hash_of_payload
```

Verify the signature using HMAC-SHA256 with your webhook secret.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `410` - Gone (expired or limit reached)
- `500` - Internal Server Error

---

## Rate Limiting

API requests are limited to 100 requests per 15 minutes per IP address.

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1704067200
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

class SBTCPaymentGateway {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  async createPayment(amount, description) {
    const response = await axios.post(
      `${this.apiUrl}/api/payments/create`,
      { amount, description },
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    return response.data;
  }

  async confirmPayment(paymentId, txId) {
    const response = await axios.post(
      `${this.apiUrl}/api/payments/${paymentId}/confirm`,
      { txId }
    );
    return response.data;
  }
}
```

### Python
```python
import requests

class SBTCPaymentGateway:
    def __init__(self, api_url, token):
        self.api_url = api_url
        self.token = token
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def create_payment(self, amount, description):
        response = requests.post(
            f'{self.api_url}/api/payments/create',
            json={'amount': amount, 'description': description},
            headers=self.headers
        )
        return response.json()
    
    def confirm_payment(self, payment_id, tx_id):
        response = requests.post(
            f'{self.api_url}/api/payments/{payment_id}/confirm',
            json={'txId': tx_id},
            headers=self.headers
        )
        return response.json()
```

---

## Testing

Use testnet for development:
- Network: Stacks Testnet
- Test sBTC tokens available from faucet
- Contract: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-payment-gateway`

---

## Support

For support and questions:
- Documentation: https://docs.your-domain.com
- Email: support@your-domain.com
- GitHub: https://github.com/your-org/sbtc-payment-gateway
