import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeApp from './HomeApp.jsx';
import AboutApp from './AboutApp.jsx';
import AdminApp from './AdminApp.jsx';
import './styles.css';

function detectPage() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = new URLSearchParams(window.location.search).get('page');

  if (pathname === '/admin' || page === 'admin') {
    return 'admin';
  }

  if (pathname === '/about' || pathname === '/documents' || page === 'about' || page === 'documents') {
    return 'about';
  }

  return 'home';
}

const root = createRoot(document.getElementById('root'));
const pageType = detectPage();

if (pageType === 'admin') {
  root.render(<AdminApp />);
} else if (pageType === 'about') {
  root.render(<AboutApp />);
} else {
  root.render(<HomeApp />);
}
