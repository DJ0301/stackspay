import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Payments from './pages/Payments'
import PaymentPage from './pages/PaymentPage'
import SubscriptionPage from './pages/SubscriptionPage'
import Integration from './pages/Integration'
import Settings from './pages/Settings'
import PaymentWidget from './components/PaymentWidget'
import Products from './pages/Products'
import PaymentLinks from './pages/PaymentLinks'
import EmbeddedCheckout from './pages/EmbeddedCheckout'
import WidgetBuilder from './pages/WidgetBuilder'
import Customers from './pages/Customers'
import Webhooks from './pages/Webhooks'
import Docs from './pages/Docs'
import APITesting from './pages/APITesting'
import ProductCheckout from './pages/ProductCheckout'
import WidgetFrame from './pages/WidgetFrame'
import Landing from './pages/Landing'
import Subscriptions from './pages/Subscriptions'

function App() {
  return (
    <>
      <Routes>
        {/* Root landing at '/' (no visible /landing path) */}
        <Route index element={<Landing />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="payments" element={<Payments />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="api-testing" element={<APITesting />} />
          <Route path="integration" element={<Integration />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/pay/:paymentId" element={<PaymentPage />} />
        <Route path="/subscribe/:subscriptionId" element={<SubscriptionPage />} />
        <Route path="/widget-demo" element={<PaymentWidget amount={1000000} />} />
        {/* Dashboard routes */}
        <Route path="/products" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Products />} />
        </Route>
        <Route path="/payment-links" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<PaymentLinks />} />
        </Route>
        <Route path="/embedded-checkout" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<EmbeddedCheckout />} />
        </Route>
        <Route path="/widget-builder" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<WidgetBuilder />} />
        </Route>
        <Route path="/subscriptions" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Subscriptions />} />
        </Route>
        <Route path="/customers" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Customers />} />
        </Route>
        <Route path="/webhooks" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Webhooks />} />
        </Route>
        <Route path="/docs" element={<Docs />} />
        {/* Public checkout route */}
        <Route path="/checkout/:productId" element={<ProductCheckout />} />
        {/* Public embeddable widget frame */}
        <Route path="/widget" element={<WidgetFrame />} />
      </Routes>
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  )
}

export default App
