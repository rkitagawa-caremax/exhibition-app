import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'  // ←★この行が超重要です！
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)