import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Connect } from '@stacks/connect-react'
import App from './App'
import './index.css'

const authOptions = {
  appDetails: {
    name: 'StacksPay',
    icon: '/logo.png',
  },
  // Keep user on the same page (e.g., payment link) after auth
  redirectTo: typeof window !== 'undefined' ? window.location.href : '/',
  // Let components update state without a hard reload
  onFinish: () => {},
  onCancel: () => {},
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Connect authOptions={authOptions}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Connect>
  </React.StrictMode>
)
