import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PaymentWidget from '../components/PaymentWidget'

function SubscriptionPage() {
  const { subscriptionId } = useParams()
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSub()
  }, [subscriptionId])

  const fetchSub = async () => {
    try {
      const res = await axios.get(`/api/payments/${subscriptionId}`)
      setSub(res.data.payment)
      setLoading(false)
    } catch (e) {
      console.error('Error fetching subscription:', e)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Not Found</h2>
          <p className="text-gray-600">This link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-indigo-100 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <PaymentWidget
          paymentId={subscriptionId}
          amount={sub.amount}
          amountUSD={sub.amountUSD}
          metadata={{ ...sub.metadata, subscription: true, interval: sub?.subscription?.interval }}
          showQR={true}
        />
      </div>
    </div>
  )
}

export default SubscriptionPage
