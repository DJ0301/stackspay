import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { User, Building, Globe, Shield, Bell, Wallet, Code, AlertCircle, Check } from 'lucide-react'

function Settings() {
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState({
    businessName: 'sBTC Merchant',
    email: 'merchant@example.com',
    phone: '',
    website: '',
    country: 'United States',
    timezone: 'America/New_York',
    address: '',
    city: '',
    state: '',
    zip: ''
  })
  const [apiKeys, setApiKeys] = useState({
    publishable: 'pk_test_' + Math.random().toString(36).substr(2, 32),
    secret: 'sk_test_' + Math.random().toString(36).substr(2, 32)
  })
  const [webhooks, setWebhooks] = useState([])
  const [notifications, setNotifications] = useState({
    paymentSuccess: true,
    paymentFailed: true,
    dailySummary: false,
    lowBalance: true
  })
  const [walletSettings, setWalletSettings] = useState({
    autoConvert: false,
    minBalance: 0.001,
    withdrawalAddress: ''
  })
  const [wallets, setWallets] = useState({ withdrawalAddresses: [], primaryAddress: null })
  const [newWallet, setNewWallet] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Auto-auth similar to PaymentLinks
  const ensureMerchantToken = async () => {
    let token = localStorage.getItem('merchantToken')
    if (token) return token
    try {
      const health = await axios.get('/api/health')
      const merchantAddress = health.data?.merchantAddress
      if (!merchantAddress) return null
      const login = await axios.post('/api/auth/login', { merchantAddress })
      token = login.data?.token
      if (token) localStorage.setItem('merchantToken', token)
      return token
    } catch {
      return null
    }
  }

  const loadWallets = async () => {
    const token = await ensureMerchantToken()
    if (!token) return
    try {
      const res = await axios.get('/api/merchant/wallets', { headers: { Authorization: `Bearer ${token}` } })
      setWallets({
        withdrawalAddresses: res.data?.withdrawalAddresses || [],
        primaryAddress: res.data?.primaryAddress || null
      })
    } catch (e) {
      console.error('Failed to load wallets', e)
    }
  }

  const addWallet = async (makePrimary = false) => {
    const address = newWallet.trim()
    if (!address) return
    const token = await ensureMerchantToken()
    if (!token) return
    try {
      const res = await axios.post('/api/merchant/wallets', { address, makePrimary }, { headers: { Authorization: `Bearer ${token}` } })
      setWallets(res.data)
      setNewWallet('')
    } catch (e) {
      console.error('Failed to add wallet', e)
    }
  }

  const setPrimary = async (address) => {
    const token = await ensureMerchantToken()
    if (!token) return
    try {
      const res = await axios.put('/api/merchant/wallets/primary', { address }, { headers: { Authorization: `Bearer ${token}` } })
      setWallets(res.data)
    } catch (e) {
      console.error('Failed to set primary wallet', e)
    }
  }

  const removeWallet = async (address) => {
    const token = await ensureMerchantToken()
    if (!token) return
    try {
      const res = await axios.delete(`/api/merchant/wallets/${encodeURIComponent(address)}`, { headers: { Authorization: `Bearer ${token}` } })
      setWallets(res.data)
    } catch (e) {
      console.error('Failed to delete wallet', e)
    }
  }

  useEffect(() => {
    loadWallets()
  }, [])

  const tabs = [
    { id: 'profile', label: 'Business Profile', icon: Building },
    { id: 'api', label: 'API Keys', icon: Code },
    { id: 'webhooks', label: 'Webhooks', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'security', label: 'Security', icon: Shield }
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-300 mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-64">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow">
            {activeTab === 'profile' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-6">Business Information</h2>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.businessName}
                        onChange={(e) => setProfile({...profile, businessName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.email}
                        onChange={(e) => setProfile({...profile, email: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.phone}
                        onChange={(e) => setProfile({...profile, phone: e.target.value})}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.website}
                        onChange={(e) => setProfile({...profile, website: e.target.value})}
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={profile.address}
                      onChange={(e) => setProfile({...profile, address: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.city}
                        onChange={(e) => setProfile({...profile, city: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.state}
                        onChange={(e) => setProfile({...profile, state: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.zip}
                        onChange={(e) => setProfile({...profile, zip: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.country}
                        onChange={(e) => setProfile({...profile, country: e.target.value})}
                      >
                        <option>United States</option>
                        <option>Canada</option>
                        <option>United Kingdom</option>
                        <option>Australia</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={profile.timezone}
                        onChange={(e) => setProfile({...profile, timezone: e.target.value})}
                      >
                        <option>America/New_York</option>
                        <option>America/Chicago</option>
                        <option>America/Denver</option>
                        <option>America/Los_Angeles</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-6">API Keys</h2>
                <div className="space-y-6">
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-primary-600 mt-0.5" />
                      <div className="text-sm text-primary-900">
                        <p className="font-medium">Test mode</p>
                        <p className="mt-1">You're currently in test mode. Payments are simulated and no real sBTC will be transferred.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Publishable key</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 font-mono text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={apiKeys.publishable}
                        readOnly
                      />
                      <button className="px-4 py-2 text-sm font-medium text-primary-600 bg-white border border-primary-200 rounded-lg hover:bg-primary-50">
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Use this key in your frontend code</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Secret key</label>
                    <div className="flex space-x-2">
                      <input
                        type="password"
                        className="flex-1 px-3 py-2 font-mono text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={apiKeys.secret}
                        readOnly
                      />
                      <button className="px-4 py-2 text-sm font-medium text-primary-600 bg-white border border-primary-200 rounded-lg hover:bg-primary-50">
                        Reveal
                      </button>
                      <button className="px-4 py-2 text-sm font-medium text-primary-600 bg-white border border-primary-200 rounded-lg hover:bg-primary-50">
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Keep this key secret and use only in your backend code</p>
                  </div>

                  <div className="pt-4 border-t">
                    <button className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700">
                      Roll keys
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'webhooks' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold">Webhooks</h2>
                  <button className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">
                    Add endpoint
                  </button>
                </div>
                
                {webhooks.length === 0 ? (
                  <div className="text-center py-12">
                    <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No webhook endpoints configured</p>
                    <p className="text-sm text-gray-500 mt-1">Add an endpoint to receive real-time payment notifications</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Webhook list would go here */}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-6">Email Notifications</h2>
                <div className="space-y-4">
                  {Object.entries({
                    paymentSuccess: 'Successful payments',
                    paymentFailed: 'Failed payments',
                    dailySummary: 'Daily summary',
                    lowBalance: 'Low balance alerts'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between py-3 border-b">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        checked={notifications[key]}
                        onChange={(e) => setNotifications({...notifications, [key]: e.target.checked})}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-6">Wallet Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Withdrawal Address</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={newWallet}
                      onChange={(e) => setNewWallet(e.target.value)}
                      placeholder="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
                    />
                    <p className="text-xs text-gray-500 mt-1">Your Stacks address for automatic withdrawals</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => addWallet(false)} className="px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50">Add</button>
                      <button onClick={() => addWallet(true)} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Add & Set Primary</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Saved Addresses</label>
                    {wallets.withdrawalAddresses.length === 0 ? (
                      <p className="text-sm text-gray-500">No addresses added yet.</p>
                    ) : (
                      <ul className="divide-y">
                        {wallets.withdrawalAddresses.map(addr => (
                          <li key={addr} className="py-2 flex items-center justify-between">
                            <div>
                              <div className="font-mono text-sm">{addr}</div>
                              {wallets.primaryAddress === addr && (
                                <div className="text-xs text-green-600">Primary</div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {wallets.primaryAddress !== addr && (
                                <button onClick={() => setPrimary(addr)} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">Make Primary</button>
                              )}
                              <button onClick={() => removeWallet(addr)} className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">Remove</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Balance (sBTC)</label>
                    <input
                      type="number"
                      step="0.00000001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={walletSettings.minBalance}
                      onChange={(e) => setWalletSettings({...walletSettings, minBalance: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 mt-1">Keep at least this amount in your wallet</p>
                  </div>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      checked={walletSettings.autoConvert}
                      onChange={(e) => setWalletSettings({...walletSettings, autoConvert: e.target.checked})}
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Auto-convert to STX</span>
                      <p className="text-xs text-gray-500">Automatically convert sBTC payments to STX</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-6">Security Settings</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Two-factor authentication</h3>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <Check className="w-5 h-5 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">Enabled</p>
                          <p className="text-xs text-green-700">Your account is protected with 2FA</p>
                        </div>
                        <button className="text-sm text-green-600 hover:text-green-700">Configure</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Login sessions</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium">Current session</p>
                          <p className="text-xs text-gray-500">Chrome on macOS • San Francisco, CA</p>
                        </div>
                        <span className="text-xs text-green-600 font-medium">Active now</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <button className="text-sm text-red-600 hover:text-red-700">Sign out all other sessions</button>
                  </div>
                </div>
              </div>
            )}

            {/* Save button */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center space-x-2"
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
