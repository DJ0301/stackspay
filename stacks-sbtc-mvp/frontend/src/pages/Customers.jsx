import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, 
  Plus, 
  ArrowUpDown, 
  User, 
  Mail, 
  Phone, 
  Download,
  Filter,
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Eye,
  MoreVertical,
  MapPin,
  Clock,
  Star,
  Activity,
  BarChart3,
  PieChart,
  Users
} from 'lucide-react'
import axios from 'axios'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

function Customers() {
  const [customers, setCustomers] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'totalSpent', dir: 'desc' })
  const [statusFilter, setStatusFilter] = useState('all') // all|active|inactive
  const [dateRange, setDateRange] = useState(30) // days
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [viewMode, setViewMode] = useState('table') // table|cards
  const [currency, setCurrency] = useState('SBTC')
  const [btcPrice, setBtcPrice] = useState(0)
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    repeatCustomerRate: 0,
    newCustomersThisMonth: 0,
    topSpender: null
  })

  useEffect(() => {
    fetchCustomerData()
    fetchBTCPrice()
    const interval = setInterval(fetchCustomerData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    computeCustomerStats()
  }, [payments, dateRange])

  const fetchBTCPrice = async () => {
    try {
      const res = await axios.get('/api/health')
      setBtcPrice(res.data?.btcPrice || 0)
    } catch (e) {
      console.error('Error fetching BTC price:', e)
    }
  }

  const fetchCustomerData = async () => {
    try {
      setLoading(true)
      // Fetch all payments to analyze customer data
      const paymentsRes = await axios.get('/api/merchant/payments', { 
        params: { limit: 1000 } 
      })
      const allPayments = paymentsRes.data.payments || []
      setPayments(allPayments)
      
      // Process customer data from payments
      const customerMap = new Map()
      
      allPayments.forEach(payment => {
        const customerId = payment.payer || payment.customerAddress || 'anonymous'
        const customerEmail = payment.metadata?.customerEmail || null
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            id: customerId,
            address: customerId,
            email: customerEmail,
            name: customerEmail ? customerEmail.split('@')[0] : `Customer ${customerId.slice(0, 8)}`,
            totalSpent: 0,
            totalSpentUSD: 0,
            orders: 0,
            completedOrders: 0,
            firstOrder: payment.createdAt,
            lastOrder: payment.createdAt,
            avgOrderValue: 0,
            status: 'active',
            paymentMethods: new Set(),
            products: new Set(),
            monthlySpending: {},
            orderHistory: []
          })
        }
        
        const customer = customerMap.get(customerId)
        customer.orders += 1
        customer.orderHistory.push(payment)
        
        if (payment.status === 'completed') {
          customer.completedOrders += 1
          customer.totalSpent += payment.amount || 0
          customer.totalSpentUSD += payment.amountUSD || 0
        }
        
        customer.paymentMethods.add(payment.paymentMethod || 'sbtc')
        if (payment.metadata?.productId) {
          customer.products.add(payment.metadata.productId)
        }
        
        // Track monthly spending
        const month = new Date(payment.createdAt).toISOString().slice(0, 7)
        if (!customer.monthlySpending[month]) customer.monthlySpending[month] = 0
        if (payment.status === 'completed') {
          customer.monthlySpending[month] += payment.amount || 0
        }
        
        // Update date range
        if (new Date(payment.createdAt) < new Date(customer.firstOrder)) {
          customer.firstOrder = payment.createdAt
        }
        if (new Date(payment.createdAt) > new Date(customer.lastOrder)) {
          customer.lastOrder = payment.createdAt
        }
      })
      
      // Convert to array and calculate derived fields
      const customerList = Array.from(customerMap.values()).map(customer => {
        customer.avgOrderValue = customer.completedOrders > 0 ? customer.totalSpent / customer.completedOrders : 0
        customer.paymentMethods = Array.from(customer.paymentMethods)
        customer.products = Array.from(customer.products)
        customer.daysSinceLastOrder = Math.floor((Date.now() - new Date(customer.lastOrder)) / (1000 * 60 * 60 * 24))
        customer.status = customer.daysSinceLastOrder > 90 ? 'inactive' : 'active'
        return customer
      })
      
      setCustomers(customerList)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching customer data:', error)
      setLoading(false)
    }
  }

  const computeCustomerStats = () => {
    const now = new Date()
    const rangeStart = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000)
    
    const rangePayments = payments.filter(p => new Date(p.createdAt) >= rangeStart)
    const completedPayments = rangePayments.filter(p => p.status === 'completed')
    
    const totalRevenue = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const avgOrderValue = completedPayments.length > 0 ? totalRevenue / completedPayments.length : 0
    
    const activeCustomers = customers.filter(c => c.status === 'active').length
    const repeatCustomers = customers.filter(c => c.completedOrders > 1).length
    const repeatCustomerRate = customers.length > 0 ? (repeatCustomers / customers.length) * 100 : 0
    
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const newCustomersThisMonth = customers.filter(c => new Date(c.firstOrder) >= thisMonth).length
    
    const topSpender = customers.reduce((top, customer) => 
      (!top || customer.totalSpent > top.totalSpent) ? customer : top, null
    )
    
    setStats({
      totalCustomers: customers.length,
      activeCustomers,
      totalRevenue,
      avgOrderValue,
      repeatCustomerRate,
      newCustomersThisMonth,
      topSpender
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = customers.filter(customer => {
      // Text search
      const matchesQuery = !q || [
        customer.name,
        customer.email,
        customer.address,
        customer.id
      ].some(field => String(field || '').toLowerCase().includes(q))
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter
      
      return matchesQuery && matchesStatus
    })
    
    // Sort
    list = [...list].sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1
      if (['totalSpent', 'orders', 'completedOrders', 'avgOrderValue', 'daysSinceLastOrder'].includes(sort.key)) {
        return (a[sort.key] - b[sort.key]) * dir
      }
      return String(a[sort.key] || '').localeCompare(String(b[sort.key] || '')) * dir
    })
    
    return list
  }, [customers, query, sort, statusFilter])

  const toggleSort = (key) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  }

  const formatCurrency = (amount, showCurrency = true) => {
    if (currency === 'USD' && btcPrice > 0) {
      const usd = amount * btcPrice
      return showCurrency ? `$${usd.toFixed(2)}` : usd.toFixed(2)
    }
    return showCurrency ? `${amount.toFixed(8)} sBTC` : amount.toFixed(8)
  }

  const exportCustomers = () => {
    const headers = ['Address', 'Name', 'Email', 'Total Spent (sBTC)', 'Total Spent (USD)', 'Orders', 'Completed Orders', 'Avg Order Value', 'First Order', 'Last Order', 'Status', 'Days Since Last Order']
    const rows = filtered.map(customer => [
      customer.address,
      customer.name,
      customer.email || '',
      customer.totalSpent.toFixed(8),
      (customer.totalSpent * btcPrice).toFixed(2),
      customer.orders,
      customer.completedOrders,
      customer.avgOrderValue.toFixed(8),
      customer.firstOrder,
      customer.lastOrder,
      customer.status,
      customer.daysSinceLastOrder
    ])
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openCustomerDetail = (customer) => {
    setSelectedCustomer(customer)
    setShowDetailModal(true)
  }

  // Customer spending trend data
  const customerTrendData = useMemo(() => {
    const last6Months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      last6Months.push(date.toISOString().slice(0, 7))
    }
    
    const monthlyData = last6Months.map(month => {
      const monthCustomers = customers.filter(c => {
        const firstOrderMonth = new Date(c.firstOrder).toISOString().slice(0, 7)
        return firstOrderMonth === month
      }).length
      
      const monthlyRevenue = customers.reduce((sum, c) => {
        return sum + (c.monthlySpending[month] || 0)
      }, 0)
      
      return { month, newCustomers: monthCustomers, revenue: monthlyRevenue }
    })
    
    return {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: 'New Customers',
          data: monthlyData.map(d => d.newCustomers),
          backgroundColor: '#F7931A',
          yAxisID: 'y'
        },
        {
          label: 'Revenue (sBTC)',
          data: monthlyData.map(d => d.revenue),
          backgroundColor: 'rgba(247, 147, 26, 0.35)',
          yAxisID: 'y1'
        }
      ]
    }
  }, [customers])

  // Customer segments
  const customerSegments = useMemo(() => {
    const segments = {
      'High Value': customers.filter(c => c.totalSpent > 0.01).length,
      'Medium Value': customers.filter(c => c.totalSpent > 0.001 && c.totalSpent <= 0.01).length,
      'Low Value': customers.filter(c => c.totalSpent <= 0.001 && c.totalSpent > 0).length,
      'No Purchases': customers.filter(c => c.totalSpent === 0).length
    }
    
    return {
      labels: Object.keys(segments),
      datasets: [{
        data: Object.values(segments),
        backgroundColor: ['#F7931A', 'rgba(247,147,26,0.65)', '#F59E0B', '#FDBA74']
      }]
    }
  }, [customers])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-white/70 mt-1">Comprehensive customer analytics and management</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range */}
          <select 
            className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          
          {/* Currency Toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
            {['SBTC', 'USD'].map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  currency === c ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          
          <button onClick={exportCustomers} className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-600 mb-1">Total Customers</p>
              <p className="text-2xl font-bold text-primary-900">{stats.totalCustomers}</p>
              <p className="text-xs text-primary-700 mt-1">{stats.activeCustomers} active</p>
            </div>
            <Users className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-primary-900">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-xs text-primary-700 mt-1">Last {dateRange} days</p>
            </div>
            <DollarSign className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-600 mb-1">Avg Order Value</p>
              <p className="text-2xl font-bold text-primary-900">{formatCurrency(stats.avgOrderValue)}</p>
              <p className="text-xs text-primary-700 mt-1">{stats.repeatCustomerRate.toFixed(1)}% repeat rate</p>
            </div>
            <TrendingUp className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 mb-1">New This Month</p>
              <p className="text-2xl font-bold text-orange-900">{stats.newCustomersThisMonth}</p>
              <p className="text-xs text-orange-700 mt-1">
                {stats.topSpender ? `Top: ${formatCurrency(stats.topSpender.totalSpent)}` : 'No data'}
              </p>
            </div>
            <Star className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>
      
      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Customer Acquisition & Revenue
          </h3>
          <div className="h-64">
            <Bar 
              data={customerTrendData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'New Customers' }
                  },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Revenue (sBTC)' },
                    grid: { drawOnChartArea: false }
                  }
                }
              }}
            />
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" /> Customer Segments
          </h3>
          <div className="h-64 flex items-center justify-center">
            <Doughnut 
              data={customerSegments}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search by name, email, address..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <select 
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer List - Table or Cards View */}
      {viewMode === 'table' ? (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort('orders')}>
                  Orders <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort('totalSpent')}>
                  Total Spent <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort('avgOrderValue')}>
                  Avg Order <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => toggleSort('daysSinceLastOrder')}>
                  Last Order <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {customer.email ? (
                            <>
                              <Mail className="w-3 h-3" /> {customer.email}
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3 h-3" /> {customer.address.slice(0, 8)}...{customer.address.slice(-6)}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{customer.completedOrders}</div>
                    <div className="text-xs text-gray-500">{customer.orders} total</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{formatCurrency(customer.totalSpent)}</div>
                    {currency === 'SBTC' && btcPrice > 0 && (
                      <div className="text-xs text-gray-500">${(customer.totalSpent * btcPrice).toFixed(2)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{formatCurrency(customer.avgOrderValue)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {customer.daysSinceLastOrder === 0 ? 'Today' : `${customer.daysSinceLastOrder}d ago`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(customer.lastOrder).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      customer.status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => openCustomerDetail(customer)}
                      className="text-primary-600 hover:underline text-xs flex items-center gap-1 ml-auto"
                    >
                      <Eye className="w-3 h-3" /> View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    {query || statusFilter !== 'all' ? 'No customers match your filters' : 'No customers found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((customer) => (
            <div key={customer.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openCustomerDetail(customer)}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                  <p className="text-sm text-gray-500">
                    {customer.email || `${customer.address.slice(0, 8)}...${customer.address.slice(-6)}`}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  customer.status === 'active' 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {customer.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Total Spent</p>
                  <p className="font-semibold">{formatCurrency(customer.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Orders</p>
                  <p className="font-semibold">{customer.completedOrders}/{customer.orders}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg Order</p>
                  <p className="font-semibold">{formatCurrency(customer.avgOrderValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Order</p>
                  <p className="font-semibold">{customer.daysSinceLastOrder}d ago</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  Joined {new Date(customer.firstOrder).toLocaleDateString()}
                </div>
                <button className="text-primary-600 hover:underline text-xs flex items-center gap-1">
                  <Eye className="w-3 h-3" /> View Details
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">
                {query || statusFilter !== 'all' ? 'No customers match your filters' : 'No customers found'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Customer Detail Modal */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                    <p className="text-gray-600">
                      {selectedCustomer.email || `${selectedCustomer.address.slice(0, 12)}...${selectedCustomer.address.slice(-8)}`}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      selectedCustomer.status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedCustomer.status}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Customer Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-primary-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-primary-600 mb-1">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Orders</span>
                  </div>
                  <div className="text-2xl font-bold text-primary-900">{selectedCustomer.orders}</div>
                  <div className="text-xs text-primary-700">{selectedCustomer.completedOrders} completed</div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Spent</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{formatCurrency(selectedCustomer.totalSpent)}</div>
                  {currency === 'SBTC' && btcPrice > 0 && (
                    <div className="text-xs text-green-700">${(selectedCustomer.totalSpent * btcPrice).toFixed(2)}</div>
                  )}
                </div>
                
                <div className="bg-primary-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-primary-600 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">Avg Order</span>
                  </div>
                  <div className="text-2xl font-bold text-primary-900">{formatCurrency(selectedCustomer.avgOrderValue)}</div>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-orange-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Last Order</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-900">{selectedCustomer.daysSinceLastOrder}d</div>
                  <div className="text-xs text-orange-700">ago</div>
                </div>
              </div>
              
              {/* Customer Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Address:</span>
                      <span className="font-mono text-xs">{selectedCustomer.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">First Order:</span>
                      <span>{new Date(selectedCustomer.firstOrder).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Order:</span>
                      <span>{new Date(selectedCustomer.lastOrder).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Methods:</span>
                      <span>{selectedCustomer.paymentMethods.join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Products Purchased:</span>
                      <span>{selectedCustomer.products.length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Monthly Spending</h3>
                  <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
                    {Object.entries(selectedCustomer.monthlySpending)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .slice(0, 6)
                      .map(([month, amount]) => (
                        <div key={month} className="flex justify-between">
                          <span className="text-gray-600">{month}:</span>
                          <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              
              {/* Order History */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Order History</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {selectedCustomer.orderHistory
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 10)
                    .map((order, index) => (
                      <div key={index} className="p-4 border-b border-gray-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{formatCurrency(order.amount || 0)}</div>
                            <div className="text-sm text-gray-600">
                              {new Date(order.createdAt).toLocaleDateString()} • 
                              {order.metadata?.productId ? ` Product ${order.metadata.productId.slice(0, 8)}` : ' Direct payment'}
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            order.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  {selectedCustomer.orderHistory.length === 0 && (
                    <div className="p-4 text-center text-gray-500">No orders found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
