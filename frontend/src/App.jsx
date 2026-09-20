import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AppRouter from './router';

function App() {
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'var(--bg-modal)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: 'var(--success)', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: 'var(--danger)', secondary: 'white' },
          },
        }} 
      />
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
