import React, { useState, useEffect } from 'react'
import { useConnect } from '@stacks/connect-react'
import { showConnect } from '@stacks/connect'
import { 
  makeContractCall,
  AnchorMode,
  uintCV,
  PostConditionMode,
  principalCV,
  cvToHex,
} from '@stacks/transactions'
import { StacksTestnet } from '@stacks/network'
import { toast } from 'react-toastify'
import axios from 'axios'
import QRCode from 'qrcode'
import { Wallet, Loader2, CheckCircle, XCircle, Bitcoin } from 'lucide-react'

function PaymentWidget({ 
  amount, 
  amountUSD, 
  paymentId: propPaymentId,
  onSuccess,
  onError,
  metadata = {},
  showQR = true,
  theme = 'light',
  disableAutoCreate = false,
}) {
  const { doContractCall, userSession } = useConnect()
  const [paymentId, setPaymentId] = useState(propPaymentId)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState('idle') // idle, processing, success, error
  const [paymentData, setPaymentData] = useState(null)
  const [qrCode, setQrCode] = useState('')
  const [btcPrice, setBtcPrice] = useState(0)
  const [contractAddress, setContractAddress] = useState('')
  const [contractName, setContractName] = useState('')
  const [merchantAddress, setMerchantAddress] = useState('')
  const [rpcConnected, setRpcConnected] = useState(false)
  const [rpcAddress, setRpcAddress] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [confirmedTxId, setConfirmedTxId] = useState(null)

  const network = new StacksTestnet()
  const SBTC_CONTRACT = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4'
  const SBTC_TOKEN = 'sbtc-token'

  useEffect(() => {
    if (!disableAutoCreate) {
      if (!paymentId) {
        createPayment()
      } else {
        fetchPaymentData(paymentId)
      }
    }
    fetchHealth()
  }, [])

  useEffect(() => {
    if (showQR && paymentData?.paymentLink) {
      generateQR(paymentData.paymentLink)
    }
  }, [paymentData, showQR])

  

  const fetchHealth = async () => {
    try {
      const response = await axios.get('/api/health')
      setBtcPrice(response.data.btcPrice)
      if (response.data?.contract) {
        const [addr, name] = response.data.contract.split('.')
        setContractAddress(addr || '')
        setContractName(name || '')
      }
      // Only set merchant from health if we don't already have it from payment
      if (!paymentData?.merchantAddress && response.data?.merchantAddress) {
        setMerchantAddress(response.data.merchantAddress)
      }
    } catch (error) {
      console.error('Error fetching health:', error)
    }
  }

  const createPayment = async () => {
    try {
      const response = await axios.post('/api/payments/create', {
        amount: amount || null,
        amountUSD: amountUSD || null,
        metadata
      })
      setPaymentId(response.data.id)
      setPaymentData(response.data)
    } catch (error) {
      console.error('Error creating payment:', error)
      setStatus('error')
      onError?.('Failed to create payment')
    }
  }

  useEffect(() => {
    let interval
    const hasConfirmed = !!(confirmedTxId || paymentData?.confirmedTxId)
    if (!hasConfirmed && (submitted || (paymentData && paymentData.txId))) {
      // Poll for transaction status every 3 seconds until we have confirmedTxId
      interval = setInterval(checkTransactionStatus, 3000)
      checkTransactionStatus() // Check immediately
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [submitted, paymentData, confirmedTxId, paymentId])

  const fetchPaymentData = async (id) => {
    try {
      const targetId = id || paymentId || propPaymentId
      const response = await axios.get(`/api/payments/${targetId}`)
      // Backend returns the document directly
      setPaymentData(response.data)
      if (response.data?.merchantAddress) {
        setMerchantAddress(response.data.merchantAddress)
      }
    } catch (error) {
      console.error('Error fetching payment:', error)
    }
  }

  // Keep internal paymentId in sync if the prop changes (e.g., after navigate replace)
  useEffect(() => {
    if (propPaymentId && propPaymentId !== paymentId) {
      setPaymentId(propPaymentId)
      fetchPaymentData(propPaymentId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propPaymentId])

  const generateQR = async (text) => {
    try {
      const url = await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff'
        }
      })
      setQrCode(url)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const normalizeTxId = (tx) => {
    if (!tx || typeof tx !== 'string') return tx
    return tx.startsWith('0x') ? tx.slice(2) : tx
  }

  const checkTransactionStatus = async () => {
    try {
      const effectiveId = paymentData?.id || paymentId || propPaymentId
      if (!effectiveId) return
      
      const response = await axios.get(`/api/payments/${effectiveId}/transaction-status`, {
        // Cache-busting & headers to avoid 304s
        params: { t: Date.now() },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      const { status: txStatus, confirmedTxId: newConfirmedTxId, payment: updatedPayment } = response.data
      
      // Prefer confirmedTxId if present
      let effectiveConfirmed = newConfirmedTxId || updatedPayment?.confirmedTxId
      if (effectiveConfirmed) {
        const formattedTxId = effectiveConfirmed.startsWith('0x') ? effectiveConfirmed : ('0x' + effectiveConfirmed)
        setConfirmedTxId(formattedTxId)
        setStatus('success')
        setSubmitted(false)
      } else if (txStatus === 'success' && (updatedPayment?.txId || paymentData?.txId)) {
        // Fallback: backend reports success but hasn't persisted confirmedTxId yet
        const fallback = (updatedPayment?.txId || paymentData?.txId)
        const formattedFallback = fallback?.startsWith('0x') ? fallback : (`0x${fallback}`)
        setConfirmedTxId(formattedFallback)
        setStatus('success')
        setSubmitted(false)
      } else if (updatedPayment?.status === 'completed' && (updatedPayment?.confirmedTxId || updatedPayment?.txId)) {
        // Additional safety: if DB says completed, finish even if tx_status hasn't propagated
        const finalTx = updatedPayment?.confirmedTxId || updatedPayment?.txId
        const formattedFinal = finalTx?.startsWith('0x') ? finalTx : (`0x${finalTx}`)
        setConfirmedTxId(formattedFinal)
        setStatus('success')
        setSubmitted(false)
      }
      
      if (updatedPayment) {
        setPaymentData(updatedPayment)
      }
    } catch (error) {
      console.error('Error checking transaction status:', error)
    }
  }

  // Try multiple Leather provider APIs/shapes to get a Stacks address (per Leather RPC docs)
  const getLeatherAddress = async () => {
    try {
      const provider = window?.LeatherProvider || window?.StacksProvider
      if (!provider) return ''
      let res
      // Prefer object-form request if supported; try known method names
      if (typeof provider.request === 'function') {
        const methods = [
          'stx_getAddresses', // common
          'stacks_getAddresses', // alternative
          'getAddresses', // legacy
          'stx_requestAccounts', // request accounts (prompts)
        ]
        for (const m of methods) {
          try {
            res = await provider.request({ method: m })
            if (res) break
          } catch (_) { /* try next */ }
          try {
            // Some providers accept string method
            res = await provider.request(m)
            if (res) break
          } catch (_) { /* try next */ }
        }
      }
      if (!res && typeof provider.getAddresses === 'function') {
        try { res = await provider.getAddresses() } catch (_) {}
      }
      // Parse response per docs: res.result.addresses is an array of entries with symbol
      const R = res?.result || res
      const addressesArr = R?.addresses || R?.result?.addresses
      if (Array.isArray(addressesArr)) {
        const stxEntry = addressesArr.find(a => a?.symbol === 'STX' && typeof a?.address === 'string' && a.address.startsWith('S'))
        if (stxEntry?.address) return stxEntry.address
        // If symbols not present, fallback to scanning for c32 addresses
        const anyC32 = addressesArr.find(a => typeof a?.address === 'string' && a.address.startsWith('S'))
        if (anyC32?.address) return anyC32.address
        // Log first non-Stacks address to aid debugging
        const anyStr = addressesArr.find(a => typeof a?.address === 'string')?.address
        if (anyStr) console.log('[DEBUG] Ignoring non-Stacks address from provider:', anyStr)
      }
      // Fallbacks for older shapes
      const fromGeneric = R?.address
      if (typeof fromGeneric === 'string' && fromGeneric.startsWith('S')) return fromGeneric
      if (typeof R === 'string' && R.startsWith('S')) return R
      return ''
    } catch (e) {
      console.log('[DEBUG] getLeatherAddress error:', e)
      return ''
    }
  }

  // Wait for wallet sign-in to be reflected in userSession
  const waitForSignIn = async (timeoutMs = 30000, intervalMs = 300) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (userSession?.isUserSignedIn?.()) return true
      await new Promise(r => setTimeout(r, intervalMs))
    }
    return false
  }

  const [signedIn, setSignedIn] = useState(!!userSession?.isUserSignedIn?.())

  // Periodically sync sign-in to force re-render when wallet completes auth
  useEffect(() => {
    const id = setInterval(() => {
      const val = !!userSession?.isUserSignedIn?.()
      setSignedIn(prev => (prev !== val ? val : prev))
    }, 1000)
    return () => clearInterval(id)
  }, [userSession])

  // Also resync on focus/visibility/storage change for immediate updates (no automatic RPC requests)
  useEffect(() => {
    const sync = () => {
      const val = !!userSession?.isUserSignedIn?.()
      setSignedIn(prev => (prev !== val ? val : prev))
      // reflect RPC flag from previous connection
      if (localStorage.getItem('leatherConnected') === '1' && !rpcConnected) setRpcConnected(true)
    }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('storage', sync)
    // Do not call Leather RPC on mount automatically to avoid popups
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('storage', sync)
    }
  }, [userSession])

  const connectWallet = async () => {
    try {
      setConnecting(true)
      const provider = window?.LeatherProvider
      if (provider?.request || typeof provider?.getAddresses === 'function') {
        console.log('[DEBUG] PaymentWidget.connectWallet: attempting LeatherProvider getAddresses')
        const addr = await getLeatherAddress()
        console.log('[DEBUG] Leather address resolved:', addr)
        if (addr && addr.startsWith('S')) {
          localStorage.setItem('leatherConnected', '1')
          setRpcConnected(true)
          setRpcAddress(addr)
          setConnecting(false)
          return addr
        } else {
          // Do not mark connected; ensure flag is cleared
          localStorage.removeItem('leatherConnected')
          setRpcConnected(false)
          if (addr) console.log('[DEBUG] Provider returned non-Stacks addr, not connecting:', addr)
        }
      }
      console.log('[DEBUG] connectWallet: falling back to showConnect()')
      await new Promise((resolve) => {
        showConnect({
          userSession,
          appDetails: {
            name: 'StacksPay',
            icon: '/logo.png',
          },
          redirectTo: window.location.href,
          onFinish: async () => {
            const ok = await waitForSignIn(15000, 300)
            if (ok) setSignedIn(true)
            setConnecting(false)
            resolve(null)
          },
          onCancel: () => { setConnecting(false); resolve(null) },
        })
      })
      return null
      // signedIn will update via userSession effect when wallet completes
    } catch (e) {
      console.log('[DEBUG] connectWallet error:', e)
      toast.error('Wallet connection failed')
      setConnecting(false)
      return null
    }
  }

  // Consider connected only if we have a concrete address via session or RPC
  const isConnected = signedIn || !!rpcAddress
  const currentAddress = (userSession?.loadUserData?.()?.profile?.stxAddress?.testnet) || rpcAddress || ''

  const handlePayment = async () => {
    console.log('[DEBUG] handlePayment called, isConnected:', isConnected, 'signedIn:', signedIn, 'rpcConnected:', rpcConnected)
    
    // Auto-connect if not connected
    if (!isConnected) {
      console.log('[DEBUG] Not connected, attempting auto-connect...')
      toast.info('Connecting wallet...')
      try {
        const addr = await connectWallet()
        // Wait a bit for state to update and session propagation
        await new Promise(resolve => setTimeout(resolve, 600))
        if (!userSession?.isUserSignedIn?.() && !addr && !rpcAddress) {
          toast.error('Wallet not connected')
          return
        }
      } catch (err) {
        console.error('[DEBUG] Auto-connect failed:', err)
        toast.error('Please connect your wallet manually')
        return
      }
    }

    setLoading(true)
    setStatus('processing')

    const amountSbtc = paymentData?.amount ?? amount
    console.log('[DEBUG] amountSbtc:', amountSbtc)
    if (!amountSbtc) {
      console.log('[DEBUG] Invalid amount:', amountSbtc)
      toast.error('Invalid payment amount')
      setLoading(false)
      setStatus('error')
      return
    }

    console.log('[DEBUG] contractAddress:', contractAddress, 'contractName:', contractName)
    if (!contractAddress || !contractName) {
      console.log('[DEBUG] Missing contract info')
      toast.error('Contract not available. Please try again in a moment.')
      setLoading(false)
      setStatus('error')
      return
    }

    console.log('[DEBUG] merchantAddress:', paymentData?.merchantAddress || merchantAddress)
    if (!(paymentData?.merchantAddress || merchantAddress)) {
      console.log('[DEBUG] Missing merchant address')
      toast.error('Merchant address not available. Please try again in a moment.')
      setLoading(false)
      setStatus('error')
      return
    }

    // Create post condition for sBTC transfer
    // Convert sBTC to micro-sBTC for on-chain amounts
    const finalAmountMicro = Math.floor((amountSbtc) * 100_000_000)
    console.log('[DEBUG] finalAmountMicro:', finalAmountMicro)

    // If relying on RPC and we don't yet have the address, fetch it now (user-initiated)
    let payerAddr = currentAddress
    if (!signedIn && !payerAddr) {
      const addr = await getLeatherAddress()
      if (addr) {
        payerAddr = addr
        setRpcAddress(addr)
      }
    }
    if (!payerAddr) {
      console.log('[DEBUG] Missing payer address')
      toast.error('Wallet address unavailable. Please reconnect.')
      setLoading(false)
      setStatus('error')
      return
    }
    // No post-conditions to avoid rollback from mismatched asset info

    // UUID -> first 16 hex chars -> BigInt for Clarity uint
    const paymentIdHex = paymentId?.replace(/-/g, '').slice(0, 16)
    let paymentIdUint
    try {
      paymentIdUint = BigInt('0x' + paymentIdHex)
    } catch (e) {
      console.log('[DEBUG] Failed to parse paymentId to BigInt from hex:', paymentIdHex, e)
      toast.error('Invalid payment ID')
      setLoading(false)
      setStatus('error')
      return
    }

    const options = {
      network,
      anchorMode: AnchorMode.Any,
      contractAddress,
      contractName,
      functionName: 'pay-to',
      functionArgs: [
        uintCV(paymentIdUint), // UUID as uint via BigInt
        uintCV(finalAmountMicro),
        principalCV(paymentData?.merchantAddress || merchantAddress)
      ],
      // Allow post-conditions (none provided) so tx isn't rolled back due to mismatched asset info
      postConditionMode: 'allow',
      postConditions: [],
      onFinish: async (data) => {
        console.log('[DEBUG] doContractCall onFinish:', {
          fullData: data,
          txId: data.txId,
          txid: data.txid
        });
        // Keep in processing until confirmation propagates to backend
        setStatus('processing')
        setSubmitted(true)
        
        // Update payment status
        try {
          const effectiveId = paymentData?.id || paymentId || propPaymentId
          const rawTx = data?.txId || data?.txid
          await axios.post(`/api/payments/${effectiveId}/confirm`, {
            txId: normalizeTxId(rawTx),
            customerAddress: payerAddr
          })
          setStatus('success')
        } catch (error) {
          console.log('[DEBUG] Error confirming payment:', error)
        }
        
        toast.info('Transaction submitted, awaiting confirmation...')
        onSuccess?.(data)
        setLoading(false)
      },
      onCancel: () => {
        console.log('[DEBUG] Contract call onCancel')
        setStatus('idle')
        setLoading(false)
      }
    }

    // Prefer Leather RPC stx_callContract if available, fallback to doContractCall
    const provider = window?.LeatherProvider
    const argsHex = [
      cvToHex(uintCV(paymentIdUint)),
      cvToHex(uintCV(finalAmountMicro)),
      cvToHex(principalCV(paymentData?.merchantAddress || merchantAddress)),
    ]
    if (provider?.request) {
      try {
        console.log('[DEBUG] Attempting Leather RPC stx_callContract')
        const resp = await provider.request('stx_callContract', {
          contract: `${contractAddress}.${contractName}`,
          functionName: 'pay-to',
          functionArgs: argsHex,
          // Explicitly disable postconditions at wallet level
          postConditionMode: 'allow',
          postConditions: [],
        })
        const rawTxId = resp?.result?.txid ?? resp?.txid ?? resp?.result?.txId ?? resp?.txId
        const txId = rawTxId ? (rawTxId.startsWith('0x') ? rawTxId : `0x${rawTxId}`) : null
        console.log('[DEBUG] Leather RPC response:', {
          fullResponse: resp,
          extractedTxId: txId,
          directTxid: resp?.txid,
        });
        if (txId) {
          // Mirror onFinish behavior but keep in processing until confirmed
          setStatus('processing')
          setSubmitted(true)
          try {
            const effectiveId = paymentData?.id || paymentId || propPaymentId
            await axios.post(`/api/payments/${effectiveId}/confirm`, {
              txId: normalizeTxId(txId),
              customerAddress: payerAddr
            })
            setStatus('success')
          } catch (error) {
            console.log('[DEBUG] Error confirming payment (RPC path):', error)
          }
          toast.info('Transaction submitted, awaiting confirmation...')
          onSuccess?.({ txId })
          setLoading(false)
          return
        }
        console.log('[DEBUG] Leather RPC stx_callContract returned no txId, falling back...')
      } catch (e) {
        console.log('[DEBUG] Leather RPC stx_callContract failed, falling back:', e)
      }
      // Try object-form request as a secondary attempt per Leather docs
      try {
        console.log('[DEBUG] Attempting Leather RPC stx_callContract (object-form)')
        const resp2 = await provider.request({
          method: 'stx_callContract',
          params: {
            contract: `${contractAddress}.${contractName}`,
            functionName: 'pay-to',
            functionArgs: argsHex,
            postConditionMode: 'allow',
            postConditions: [],
          }
        })
        const rawTxId2 = resp2?.result?.txid ?? resp2?.txid ?? resp2?.result?.txId ?? resp2?.txId
        const txId2 = rawTxId2 ? (rawTxId2.startsWith('0x') ? rawTxId2 : `0x${rawTxId2}`) : null
        if (txId2) {
          setStatus('processing')
          setSubmitted(true)
          try {
            const effectiveId = paymentData?.id || paymentId || propPaymentId
            await axios.post(`/api/payments/${effectiveId}/confirm`, {
              txId: normalizeTxId(txId2),
              customerAddress: payerAddr
            })
            setStatus('success')
          } catch (error) {
            console.log('[DEBUG] Error confirming payment (RPC path, object-form):', error)
          }
          toast.info('Transaction submitted, awaiting confirmation...')
          onSuccess?.({ txId: txId2 })
          setLoading(false)
          return
        }
        console.log('[DEBUG] Leather RPC stx_callContract (object-form) returned no txId, falling back...')
      } catch (e2) {
        console.log('[DEBUG] Leather RPC stx_callContract (object-form) failed, falling back:', e2)
      }
    }
    console.log('[DEBUG] About to call doContractCall with options:', options)
    try {
      await doContractCall(options)
    } catch (error) {
      console.log('[DEBUG] Error in doContractCall:', error)
      setStatus('error')
      onError?.(error.message)
      toast.error('Payment failed')
      setLoading(false)
    }
  }

  const displayAmount = (paymentData?.amount ?? amount) || 0 // sBTC
  const displayUSD = (paymentData?.amountUSD ?? amountUSD) ?? (btcPrice && displayAmount ? (displayAmount) * btcPrice : 0)

  const isDark = theme === 'dark'
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white'
  const textColor = isDark ? 'text-white' : 'text-gray-900'
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200'

  return (
    <div className={`max-w-md mx-auto p-6 rounded-xl shadow-lg ${bgColor} ${borderColor} border`}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
          <Bitcoin className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className={`text-2xl font-bold ${textColor}`}>StacksPay</h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
          Secure payment on Stacks blockchain
        </p>
        {isConnected && currentAddress && (
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Connected as {currentAddress.slice(0, 8)}...
          </p>
        )}
      </div>

      {/* Amount Display */}
      <div className={`text-center p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'} mb-6`}>
        <p className={`text-3xl font-bold ${textColor}`}>
          ${displayUSD.toFixed(2)}
        </p>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
          {(displayAmount).toFixed(6)} sBTC
        </p>
        {btcPrice > 0 && (
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
            1 BTC = ${btcPrice.toLocaleString()}
          </p>
        )}
      </div>

      {/* QR Code */}
      {showQR && qrCode && status === 'idle' && (
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-white rounded-lg">
            <img src={qrCode} alt="Payment QR Code" className="w-48 h-48" />
          </div>
        </div>
      )}

      {/* Status Messages */}
      {status === 'processing' && (
        <div className="flex items-center justify-center space-x-2 mb-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Processing payment...
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center justify-center space-x-2 mb-6 text-green-600">
          <CheckCircle className="w-5 h-5" />
          <span>Payment successful!</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-center space-x-2 mb-6 text-red-600">
          <XCircle className="w-5 h-5" />
          <span>Payment failed. Please try again.</span>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3">
        {!isConnected && (
          <button
            onClick={connectWallet}
            disabled={connecting}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${connecting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-900'}`}
          >
            {connecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                <span>Connect Wallet</span>
              </>
            )}
          </button>
        )}

        <button
          onClick={handlePayment}
          disabled={connecting || loading || status === 'success' || !contractAddress || !contractName || !(paymentData?.merchantAddress || merchantAddress)}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
            connecting || loading || status === 'success' || !contractAddress || !contractName || !(paymentData?.merchantAddress || merchantAddress)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span>{loading ? 'Processing...' : 'Pay with Wallet'}</span>
        </button>
      </div>

      {/* Payment ID */}
      {paymentId && (
        <p className={`text-xs text-center mt-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Payment ID: {paymentId.slice(0, 8)}...
        </p>
      )}

      {/* Powered By */}
      <div className={`text-center mt-6 pt-4 border-t ${borderColor}`}>
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Powered by StacksPay
        </p>
      </div>
    </div>
  )
}

export default PaymentWidget
