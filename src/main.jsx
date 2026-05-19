import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeApp from './HomeApp.jsx';
import AboutApp from './AboutApp.jsx';
import './styles.css';

function detectAboutPage() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = new URLSearchParams(window.location.search).get('page');
  return pathname === '/about' || pathname === '/documents' || page === 'about' || page === 'documents';
}

const root = createRoot(document.getElementById('root'));
const isAboutPage = detectAboutPage();

if (isAboutPage) {
  root.render(<AboutApp />);
} else {
  root.render(<HomeApp />);
}
