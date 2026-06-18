/**
 * SkyBlock Bazaar Analyzer - Main Entry Point
 * 
 * This is the entry point of the React application.
 * It initializes the React root, wraps the App component in StrictMode,
 * and mounts it to the DOM element with id "root".
 * 
 * @file main.jsx
 * @author SkyBlock Quant Terminal
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Create React root and render the application
// StrictMode enables additional development checks and warnings
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
