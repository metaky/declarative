import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import posthog from 'posthog-js';

// Initialize PostHog for analytics safely
try {
  posthog.init('phc_pvFdBKNfNPtBnedh7BuUFSNW2hYqbjb2N6kWgRdagOg', {
    api_host: 'https://app.posthog.com',
    autocapture: true, // Enable autocapture as requested
  });
} catch (error) {
  console.warn('PostHog initialization failed or was blocked:', error);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
