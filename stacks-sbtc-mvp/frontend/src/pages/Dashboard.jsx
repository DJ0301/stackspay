import React, { useState, useEffect } from 'react'
import { useConnect } from '@stacks/connect-react'
import { 
  TrendingUp, 
  Activity,
  Users,
  DollarSign,
  Plus
} from 'lucide-react'
import axios from 'axios'
import { Bar } from 'react-chartjs-2'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

function Dashboard() {
  const { userSession } = useConnect?.() || {}
  const [stats, setStats] = useState({
    totalRevenue: 0,
    thisMonth: 0,
    successRate: 0,
    pending: 0
  })
  const [recentPayments, setRecentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [totalPaymentsCount, setTotalPaymentsCount] = useState(0)
  const [walletAddress, setWalletAddress] = useState('')
  const [chartData, setChartData] = useState({
    labels: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'],
    datasets: [
      {
        label: 'Payments',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: '#E5E7EB',
        hoverBackgroundColor: '#F7931A',
        borderRadius: 4,
        barThickness: 40
      }
    ]
  })

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Resolve connected wallet address from Stacks Connect (or persisted localStorage)
  useEffect(() => {
    try {
      let addr = ''
      if (userSession?.isUserSignedIn?.()) {
        const userData = userSession.loadUserData()
        addr = userData?.profile?.stxAddress?.testnet || userData?.profile?.stxAddress?.mainnet || ''
      }
      if (!addr) {
        try { addr = localStorage.getItem('stxAddress') || '' } catch {}
      }
      if (addr) setWalletAddress(addr)
    } catch {}
  }, [userSession])

  const fetchDashboardData = async () => {
    try {
      const [paymentsRes, balanceRes] = await Promise.all([
        axios.get('/api/merchant/payments?limit=100'),
        axios.get('/api/merchant/balance')
      ])
      const payments = paymentsRes.data?.payments || []
      const bal = Number(balanceRes.data?.balance || 0)
      
      // Calculate stats from payments
      const totalRevenue = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + (p.amount || 0), 0)
      
      const thisMonth = payments
        .filter(p => {
          const date = new Date(p.createdAt)
          const now = new Date()
          return date.getMonth() === now.getMonth() && 
                 date.getFullYear() === now.getFullYear() &&
                 p.status === 'completed'
        })
        .reduce((sum, p) => sum + (p.amount || 0), 0)
      
      const completed = payments.filter(p => p.status === 'completed').length
      const total = payments.length
      const successRate = total > 0 ? (completed / total) * 100 : 0
      
      const pending = payments.filter(p => p.status === 'pending').length
      
      setStats({
        totalRevenue,
        thisMonth,
        successRate,
        pending
      })
      setBalance(bal)
      setTotalPaymentsCount(total)
      // Build 7-day payments count chart
      const days = [...Array(7)].map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        d.setHours(0, 0, 0, 0)
        return d
      })
      const perDayCounts = days.map((day, idx) => {
        const next = new Date(day)
        next.setDate(day.getDate() + 1)
        return payments.filter(p => {
          const t = new Date(p.createdAt)
          return t >= day && t < next
        }).length
      })
      const weekdayLabels = days.map(d => d.toLocaleDateString('en-US', { weekday: 'short' }))
      setChartData({
        labels: weekdayLabels,
        datasets: [
          {
            label: 'Payments',
            data: perDayCounts,
            backgroundColor: '#E5E7EB',
            hoverBackgroundColor: '#F7931A',
            borderRadius: 4,
            barThickness: 40
          }
        ]
      })
      setRecentPayments(payments.slice(0, 5))
      setLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setStats({
        totalRevenue: 0,
        thisMonth: 0,
        successRate: 0,
        pending: 0
      })
      setBalance(0)
      setLoading(false)
    }
  }

  // Fetch sBTC balance from Hiro explorer for connected wallet
  useEffect(() => {
    const controller = new AbortController()
    async function fetchExplorerBalance() {
      if (!walletAddress) return
      try {
        const apiBase = 'https://api.testnet.hiro.so'
        const url = `${apiBase}/extended/v1/tokens/balances/${walletAddress}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        const sbtcContractId = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token'
        const ft = (data?.ft_balances || []).find((t) => t?.asset?.identifier === sbtcContractId || t?.contract_identifier === sbtcContractId)
        if (ft) {
          const decimals = Number(ft?.metadata?.decimals ?? 8)
          const raw = BigInt(ft?.balance || '0')
          const denom = BigInt(10) ** BigInt(decimals)
          const integer = Number(raw / denom)
          const fraction = Number(raw % denom) / Number(denom)
          const val = integer + fraction
          if (isFinite(val)) setBalance(val)
        }
      } catch (_) {
        // ignore
      }
    }
    fetchExplorerBalance()
    const id = setInterval(fetchExplorerBalance, 30000)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [walletAddress])

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} payments`,
          title: () => ''
        },
        backgroundColor: '#111827',
        padding: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#E5E7EB',
          font: {
            size: 12
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(229,231,235,0.25)'
        },
        ticks: {
          stepSize: 1,
          callback: (value) => `${value}`,
          color: '#E5E7EB',
          font: {
            size: 12
          }
        }
      }
    }
  }

  const formatSBTC = (amount) => {
    // Safely format sBTC with 8 decimal places
    const n = Number(amount || 0)
    if (!isFinite(n)) return '0.00000000 sBTC'
    return n.toFixed(8) + ' sBTC'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }


  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Home</h1>
          <p className="text-white/70 mt-1">Welcome to your sBTC payment gateway dashboard.</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/products"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
          >
            Manage Products
          </Link>
          <Link
            to="/products/new"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
          >
            Create Product
          </Link>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
          >
            Docs
          </a>
        </div>
      </div>

      {/* Balance Card - Glassmorphism
      <div className="relative overflow-hidden rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl">
        <div className="absolute inset-0 opacity-20" style={{
          background: 'linear-gradient(90deg, #F7931A 0%, #FFD580 100%)'
        }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Current Balance</p>
            <p className="text-3xl font-bold mt-1 text-white">{formatSBTC(balance)}</p>
          </div>
        </div>
      </div> */}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <p className="text-sm text-white/70 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">{formatSBTC(stats.totalRevenue)}</p>
          <p className="text-xs text-white/60 mt-1">{totalPaymentsCount} payments</p>
        </div>
        
        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <p className="text-sm text-white/70 mb-1">This Month</p>
          <p className="text-2xl font-bold text-white">{formatSBTC(stats.thisMonth)}</p>
          <p className="text-xs text-green-300 mt-1">+0.0% from last month</p>
        </div>
        
        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <p className="text-sm text-white/70 mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-white">{stats.successRate.toFixed(0)}%</p>
          <p className="text-xs text-white/60 mt-1">0 failed payments</p>
        </div>
        
        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
          <p className="text-sm text-white/70 mb-1">Pending</p>
          <p className="text-2xl font-bold text-white">{stats.pending}</p>
          <p className="text-xs text-orange-300 mt-1">{formatSBTC(0)} value</p>
        </div>
      </div>

      {/* Chart and Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Volume Chart */}
        <div className="lg:col-span-2 rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md">
          <h2 className="text-lg font-semibold text-white mb-4">Payment Volume (7 days)</h2>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
          <div className="mt-4 text-center text-sm text-white/60">
            {totalPaymentsCount} payments
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl p-6 border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Payments</h2>
            <Link to="/payments" className="text-sm text-orange-300 hover:text-orange-200">
              View all payments →
            </Link>
          </div>
          <div className="space-y-3">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => (
                <div key={payment._id} className="pb-3 border-b border-white/10 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {formatSBTC(payment.amount || 0)}
                      </p>
                      <p className="text-xs text-white/60 mt-1">
                        {payment.payer ? `${payment.payer.slice(0, 8)}...${payment.payer.slice(-6)}` : 'No payer'}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      payment.status === 'completed' 
                        ? 'bg-green-500/15 text-green-300'
                        : payment.status === 'pending'
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'bg-red-500/15 text-red-300'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    {new Date(payment.createdAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/60">No payments yet</p>
                <p className="text-xs text-white/50 mt-1">Create a payment link to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
