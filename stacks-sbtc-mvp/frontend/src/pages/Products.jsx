import React, { useState, useEffect } from 'react'
import { Plus, Search, MoreVertical, Edit2, Trash2, Copy, ShoppingCart, ExternalLink } from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import ProductDetailsModal from '../components/ProductDetailsModal'

function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const navigate = useNavigate()

  // Form states
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productImage, setProductImage] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [btcPrice, setBtcPrice] = useState(0)

  useEffect(() => {
    fetchProducts()
    fetchBTCPrice()
  }, [])

  const fetchBTCPrice = async () => {
    try {
      const res = await axios.get('/api/health')
      setBtcPrice(res.data?.btcPrice || 0)
    } catch (e) {
      console.error('Error fetching BTC price:', e)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('merchantToken')
      const response = await axios.get('/api/merchant/products', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setProducts(response.data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
      toast.error('Failed to fetch products. Please ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProduct = async () => {
    if (!productName || !productPrice) {
      toast.error('Please fill in required fields')
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('merchantToken')
      await axios.post('/api/merchant/products', {
        name: productName,
        description: productDescription,
        price: parseFloat(productPrice),
        imageUrl: productImage,
        isActive: isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      toast.success('Product created successfully')
      setShowCreateModal(false)
      resetForm()
      fetchProducts()
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Failed to create product')
    } finally {
      setSaving(false)
    }
  }

  const handleEditProduct = async () => {
    if (!productName || !productPrice) {
      toast.error('Please fill in required fields')
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('merchantToken')
      await axios.put(`/api/merchant/products/${selectedProduct.id}`, {
        name: productName,
        description: productDescription,
        price: parseFloat(productPrice),
        imageUrl: productImage,
        isActive: isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      toast.success('Product updated successfully')
      setShowEditModal(false)
      resetForm()
      fetchProducts()
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error('Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return
    }

    try {
      const token = localStorage.getItem('merchantToken')
      await axios.delete(`/api/merchant/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Product deleted successfully')
      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    }
  }

  const openEditModal = (product) => {
    setSelectedProduct(product)
    setProductName(product.name)
    setProductDescription(product.description || '')
    setProductPrice(product.price.toString())
    setProductImage(product.imageUrl || '')
    setIsActive(product.isActive)
    setShowEditModal(true)
    setActiveDropdown(null)
  }

  const openDetailsModal = (product) => {
    setSelectedProduct(product)
    setShowDetailsModal(true)
    setActiveDropdown(null)
  }

  const handleEditFromModal = () => {
    setShowDetailsModal(false)
    openEditModal(selectedProduct)
  }

  const resetForm = () => {
    setProductName('')
    setProductDescription('')
    setProductPrice('')
    setProductImage('')
    setIsActive(true)
    setSelectedProduct(null)
  }

  const copyProductLink = (productId) => {
    const link = `${window.location.origin}/pay/${productId}`
    navigator.clipboard.writeText(link)
    toast.success('Product payment link copied to clipboard')
  }

  const openProductPayment = (productId) => {
    const link = `${window.location.origin}/pay/${productId}`
    window.open(link, '_blank')
  }

  const openProductCheckout = (productId) => {
    const checkoutLink = `${window.location.origin}/checkout/${productId}`
    window.open(checkoutLink, '_blank')
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatSBTC = (amount) => {
    return amount ? amount.toFixed(8) + ' sBTC' : '0.00000000 sBTC'
  }

  const formatUSD = (amountSBTC) => {
    if (!btcPrice || !amountSBTC) return ''
    const usd = amountSBTC * btcPrice
    return `≈ $${usd.toFixed(2)}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-white/70 mt-1">Manage your products and pricing</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <div 
              key={product.id} 
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => openDetailsModal(product)}
            >
              {product.imageUrl && (
                <div className="aspect-video bg-gray-100">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/400x300?text=Product'
                    }}
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveDropdown(activeDropdown === product.id ? null : product.id)
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {activeDropdown === product.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => openEditModal(product)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => copyProductLink(product.id)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy Payment Link</span>
                        </button>
                        <button
                          onClick={() => openProductPayment(product.id)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Test Purchase</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatSBTC(product.price)}</p>
                    {btcPrice > 0 && (
                      <p className="text-xs text-gray-500">{formatUSD(product.price)}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-xs text-gray-500">{product.paymentCount || 0} sales</p>
                      <p className="text-xs text-gray-500">
                        ≈ ${((product.paymentCount || 0) * (product.price || 0) * btcPrice).toFixed(2)} revenue
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {product.isActive && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openProductCheckout(product.id)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-md hover:bg-primary-700 transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          Buy Now
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openProductPayment(product.id)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setShowCreateModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Product</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Premium Subscription"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Brief description of your product"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (sBTC) *</label>
                <input
                  type="number"
                  step="0.00000001"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="0.00100000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productImage}
                  onChange={(e) => setProductImage(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  className="mr-2"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label htmlFor="active" className="text-sm text-gray-700">Active (available for purchase)</label>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
                disabled={saving}
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
                disabled={saving}
                onClick={handleCreateProduct}
              >
                {saving ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setShowEditModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Product</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Premium Subscription"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Brief description of your product"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (sBTC) *</label>
                <input
                  type="number"
                  step="0.00000001"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="0.00100000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productImage}
                  onChange={(e) => setProductImage(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active-edit"
                  className="mr-2"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label htmlFor="active-edit" className="text-sm text-gray-700">Active (available for purchase)</label>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
                disabled={saving}
                onClick={() => {
                  setShowEditModal(false)
                  resetForm()
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
                disabled={saving}
                onClick={handleEditProduct}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      <ProductDetailsModal
        product={selectedProduct}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setSelectedProduct(null)
        }}
        onEdit={handleEditFromModal}
      />
    </div>
  )
}

export default Products
