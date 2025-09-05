import React from 'react'
import { useConnect } from '@stacks/connect-react'
import { showConnect } from '@stacks/connect'
import { Wallet, Lock } from 'lucide-react'

function ProtectedRoute({ children }) {
  const { userSession } = useConnect()
  const isSignedIn = userSession?.isUserSignedIn()
  const rpcConnected = localStorage.getItem('leatherConnected') === '1'
  const isConnected = isSignedIn || rpcConnected

  const handleConnect = () => {
    try {
      const provider = window?.LeatherProvider
      if (provider?.request) {
        console.log('[DEBUG] ProtectedRoute.handleConnect: using LeatherProvider.request(getAddresses)')
        provider
          .request('getAddresses')
          .then((res) => {
            console.log('[DEBUG] Leather getAddresses result:', res)
            localStorage.setItem('leatherConnected', '1')
            const addr =
              res?.addresses?.stacks?.testnet?.[0]?.address ||
              res?.addresses?.stacks?.mainnet?.[0]?.address ||
              res?.stacks?.testnet?.[0]?.address ||
              res?.stacks?.mainnet?.[0]?.address ||
              res?.addresses?.[0]?.address || ''
            if (addr) {
              console.log('[DEBUG] STX address (Leather):', addr)
              try { localStorage.setItem('stxAddress', addr) } catch {}
            }
            window.location.reload()
          })
          .catch((err) => {
            console.log('[DEBUG] Leather getAddresses error:', err)
            // Fallback to stacks.js connect modal
            showConnect({
              userSession,
              appDetails: { name: 'StacksPay', icon: '/logo.png' },
              redirectTo: window.location.href,
              onFinish: () => window.location.reload(),
              onCancel: () => {},
            })
          })
        return
      }
      
      console.log('[DEBUG] ProtectedRoute.handleConnect: calling showConnect()')
      showConnect({
        userSession,
        appDetails: {
          name: 'StacksPay',
          icon: '/logo.png',
        },
        redirectTo: window.location.href,
        onFinish: () => {
          try {
            const data = userSession?.loadUserData?.()
            const addr = data?.profile?.stxAddress?.testnet || data?.profile?.stxAddress?.mainnet
            if (addr) {
              console.log('[DEBUG] STX address (Stacks Connect):', addr)
              localStorage.setItem('stxAddress', addr)
            }
            localStorage.setItem('leatherConnected', '1')
          } catch {}
          window.location.reload()
        },
        onCancel: () => {},
      })
    } catch (e) {
      console.log('[DEBUG] ProtectedRoute.handleConnect error:', e)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
            {/* Lock Icon */}
            <div className="mx-auto w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mb-6">
              <Lock className="w-8 h-8 text-primary-400" />
            </div>
            
            {/* Header */}
            <h1 className="text-2xl font-bold text-white mb-2">
              Wallet Connection Required
            </h1>
            <p className="text-white/70 mb-8">
              You need to connect your wallet to access the dashboard and manage your sBTC payments.
            </p>
            
            {/* Connect Button */}
            <button
              onClick={handleConnect}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Wallet className="w-5 h-5" />
              <span>Connect Wallet</span>
            </button>
            
            {/* Info */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Supported wallets:</strong> Leather, Xverse, and other Stacks-compatible wallets
              </p>
            </div>
            
            {/* Back to Landing */}
            <div className="mt-6">
              <a
                href="/"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                ← Back to landing page
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
