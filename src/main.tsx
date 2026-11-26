import {ClerkRoot}from './ui/ClerkRoot.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.js';
import './ui/app.css';
import './ui/productTypography.css';

createRoot(document.getElementById('root')!).render(<StrictMode><ClerkRoot><App /></ClerkRoot></StrictMode>);
