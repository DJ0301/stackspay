import React, { useState, useEffect } from 'react'
import { Search, Filter, Download, ExternalLink, Plus, Copy, Check } from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'

function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [amountSBTC, setAmountSBTC] = useState('')
  const [orderId, setOrderId] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchPayments()
  }, [page, statusFilter])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const params = { page, limit: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      
      const response = await axios.get('/api/merchant/payments', { params })
      setPayments(response.data.payments)
      setTotalPages(response.data.pagination.pages)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error('Failed to fetch payments')
      setLoading(false)
    }
  }

  const handleCreatePayment = async () => {
    const sbtc = parseFloat(amountSBTC)
    if (!sbtc || sbtc <= 0) {
      toast.error('Enter a valid sBTC amount')
      return
    }
    setCreating(true)
    try {
      const res = await axios.post('/api/payments/create', {
        amount: sbtc,
        metadata: {
          orderId: orderId || undefined,
          customerEmail: customerEmail || undefined,
        },
      })
      const id = res.data.id || res.data.payment?.id || res.data.paymentId || res.data.payment?.paymentId
      if (id) {
        setShowCreate(false)
        setAmountSBTC('')
        setOrderId('')
        setCustomerEmail('')
        navigate(`/pay/${id}`)
      } else {
        toast.error('Failed to create payment')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to create payment')
    } finally {
      setCreating(false)
    }
  }

  const exportPayments = () => {
    const csv = [
      ['Payment ID', 'Amount (sBTC)', 'USD Value', 'Status', 'Payer', 'Date'].join(','),
      ...payments.map(p => [
        p.paymentId,
        p.amount?.toFixed(8),
        (p.amountUSD ?? 0).toFixed(2),
        p.status,
        p.payer || 'N/A',
        new Date(p.createdAt).toISOString()
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Copied to clipboard')
  }

  const formatSBTC = (amount) => {
    return amount ? amount.toFixed(8) + ' sBTC' : '0.00000000 sBTC'
  }

  const filteredPayments = payments.filter(payment => 
    payment.paymentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payer?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-white/70 mt-1">View and manage all sBTC payment transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCreate(true)} 
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Payment</span>
          </button>
          <button 
            onClick={exportPayments} 
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search payments..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount (sBTC)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  USD Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {payment.paymentId.slice(0, 8)}...
                        </span>
                        <button
                          onClick={() => copyToClipboard(payment.paymentId, payment._id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedId === payment._id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatSBTC(payment.amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      ${((payment.amountUSD ?? 0).toFixed(2))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        payment.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : payment.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.payer ? (
                        <div className="font-mono text-xs">
                          {payment.payer.slice(0, 8)}...{payment.payer.slice(-6)}
                        </div>
                      ) : (
                        <span className="text-gray-400">Awaiting</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="space-y-1">
                        <div>{new Date(payment.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(payment.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {payment.completedAt && (
                          <div className="text-xs text-green-600">
                            Completed: {new Date(payment.completedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {payment.txId ? (
                        <a
                          href={`https://explorer.stacks.co/txid/${payment.txId}?chain=testnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    No payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create Payment Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !creating && setShowCreate(false)}></div>
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Payment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (sBTC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.00000001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={amountSBTC}
                  onChange={(e) => setAmountSBTC(e.target.value)}
                  placeholder="e.g. 0.00050000"
                />
                <p className="text-xs text-gray-500 mt-1">Enter the amount in sBTC (Bitcoin)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID (optional)</label>
                <input 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" 
                  value={orderId} 
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="ORD-12345" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email (optional)</label>
                <input 
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" 
                  value={customerEmail} 
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com" 
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button 
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm" 
                disabled={creating} 
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm" 
                disabled={creating} 
                onClick={handleCreatePayment}
              >
                {creating ? 'Creating...' : 'Create Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payments
