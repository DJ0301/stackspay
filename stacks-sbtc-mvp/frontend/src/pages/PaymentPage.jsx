import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import PaymentWidget from '../components/PaymentWidget'
import { CheckCircle, Loader2 } from 'lucide-react'

function PaymentPage() {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState(null)
  const [confirmedTxId, setConfirmedTxId] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetchPayment()
  }, [paymentId])

  useEffect(() => {
    let interval
    const hasConfirmed = !!(confirmedTxId || payment?.confirmedTxId)
    if (!hasConfirmed && (submitted || (payment && payment.txId))) {
      // Poll for transaction status every 5 seconds until we have confirmedTxId
      interval = setInterval(checkTransactionStatus, 5000)
      checkTransactionStatus() // Check immediately
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [submitted, payment, confirmedTxId])

  const checkTransactionStatus = async () => {
    try {
      const response = await axios.get(`/api/payments/${paymentId}/transaction-status`, {
        // Cache-busting & headers to avoid 304s
        params: { t: Date.now() },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      const { status, confirmedTxId: newConfirmedTxId, payment: updatedPayment } = response.data
      
      setTransactionStatus(status)
      
      // Prefer confirmedTxId if present
      let effectiveConfirmed = newConfirmedTxId || updatedPayment?.confirmedTxId
      if (effectiveConfirmed) {
        const formattedTxId = effectiveConfirmed.startsWith('0x') ? effectiveConfirmed : ('0x' + effectiveConfirmed)
        setConfirmedTxId(formattedTxId)
        setPaymentComplete(true) // Mark complete when we get confirmedTxId
        setSubmitted(false)
      } else if (status === 'success' && (updatedPayment?.txId || payment?.txId)) {
        // Fallback: backend reports success but hasn't persisted confirmedTxId yet
        // Use submitted txId so the user can proceed; polling can continue to update confirmedTxId later
        const fallback = (updatedPayment?.txId || payment?.txId)
        const formattedFallback = fallback?.startsWith('0x') ? fallback : (`0x${fallback}`)
        setConfirmedTxId(formattedFallback)
        setPaymentComplete(true)
        setSubmitted(false)
      } else if (updatedPayment?.status === 'completed' && (updatedPayment?.confirmedTxId || updatedPayment?.txId)) {
        // Additional safety: if DB says completed, finish even if tx_status hasn't propagated
        const finalTx = updatedPayment?.confirmedTxId || updatedPayment?.txId
        const formattedFinal = finalTx?.startsWith('0x') ? finalTx : (`0x${finalTx}`)
        setConfirmedTxId(formattedFinal)
        setPaymentComplete(true)
        setSubmitted(false)
      }
      
      if (updatedPayment) {
        setPayment(updatedPayment)
      }
    } catch (error) {
      console.error('Error checking transaction status:', error)
    }
  }

  const fetchPayment = async () => {
    try {
      const response = await axios.get(`/api/payments/${paymentId}`)
      // Found a real payment by id
      setPayment(response.data)
      const confirmed = response.data.confirmedTxId
      if (confirmed) {
        const formatted = confirmed.startsWith('0x') ? confirmed : `0x${confirmed}`
        response.data.confirmedTxId = formatted
        setConfirmedTxId(formatted)
        setPaymentComplete(true)
      } else {
        setPaymentComplete(false)
      }
      setLoading(false)
    } catch (error) {
      // If payment not found, attempt to treat paymentId as a Payment Link ID or Product ID
      if (error?.response?.status === 404) {
        try {
          // First try as payment link
          const linkRes = await axios.get(`/api/payment-links/${paymentId}`)
          const link = linkRes.data
          // Create a payment using link's configured amounts
          const payload = {}
          if (!link.allowCustomAmount) {
            if (link.amount != null) payload.amount = link.amount
            else if (link.amountUSD != null) payload.amountUSD = link.amountUSD
          }
          // include link id in metadata for traceability
          payload.metadata = { ...(link.metadata || {}), paymentLinkId: link.id }

          const createRes = await axios.post('/api/payments/create', payload)
          const created = createRes.data
          setPayment(created)
          setPaymentComplete(created.status === 'completed')
          // Replace URL to the new payment id for consistency
          navigate(`/pay/${created.id}`, { replace: true })
          setLoading(false)
        } catch (linkError) {
          // If not a payment link, try as product
          try {
            const productRes = await axios.get(`/api/products/${paymentId}`)
            const product = productRes.data
            // Create a payment using product's price
            const payload = {
              amount: product.price,
              metadata: { 
                productId: product.id,
                productName: product.name,
                productDescription: product.description
              }
            }

            const createRes = await axios.post('/api/payments/create', payload)
            const created = createRes.data
            setPayment(created)
            setPaymentComplete(created.status === 'completed')
            // Replace URL to the new payment id for consistency
            navigate(`/pay/${created.id}`, { replace: true })
            setLoading(false)
          } catch (productError) {
            console.error('Error handling product purchase:', productError)
            setLoading(false)
          }
        }
      } else {
        console.error('Error fetching payment:', error)
        setLoading(false)
      }
    }
  }

  const handleSuccess = () => {
    // The wallet reported success (tx submitted). Do not show success page yet.
    // Show a processing state until we have a confirmedTxId from backend polling.
    setSubmitted(true)
    setTransactionStatus((prev) => prev || 'pending')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Not Found</h2>
          <p className="text-gray-600">This payment link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-sky-50 py-16 px-4">
      <div className="max-w-lg mx-auto">
        {paymentComplete && (confirmedTxId || payment?.confirmedTxId) ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-black/5 p-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-100">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 mb-2">Payment Complete</h2>
            <p className="text-gray-600 mb-6">Your payment has been successfully processed.</p>
            <div className="bg-gray-50 rounded-lg p-4 text-left border border-gray-100">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Transaction ID</p>
              <div className="font-mono text-sm font-medium text-gray-900 break-all select-all">
                {confirmedTxId || payment.confirmedTxId}
              </div>
            </div>
            <a
              href={`https://explorer.hiro.so/txid/${confirmedTxId || payment.confirmedTxId}?chain=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center mt-6 px-5 py-2.5 rounded-md bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors shadow-sm"
            >
              View on Explorer
            </a>
            <p className="mt-3 text-xs text-gray-500">It can take a few blocks to finalize on-chain.</p>
          </div>
        ) : (submitted || (payment && payment.txId)) && (!confirmedTxId && !payment?.confirmedTxId) ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-black/5 p-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="w-14 h-14 text-blue-600 mx-auto mb-5 animate-spin" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Processing Payment</h2>
            <p className="text-gray-600 mb-6">Waiting for on-chain confirmation. This usually completes within a minute.</p>
            {payment?.txId && (
              <>
                <div className="bg-gray-50 rounded-lg p-4 text-left border border-gray-100">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Transaction ID</p>
                  <div className="font-mono text-sm font-medium text-gray-900 break-all select-all">{payment.txId}</div>
                </div>
                <a
                  href={`https://explorer.hiro.so/txid/${payment.txId}?chain=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center mt-6 px-5 py-2.5 rounded-md bg-gray-700 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors shadow-sm"
                >
                  View on Explorer
                </a>
              </>
            )}
          </div>
        ) : (
          <PaymentWidget
            paymentId={paymentId}
            amount={payment.amount}
            amountUSD={payment.amountUSD}
            metadata={payment.metadata}
            onSuccess={handleSuccess}
            showQR={true}
          />
        )}
      </div>
    </div>
  )
}

export default PaymentPage
