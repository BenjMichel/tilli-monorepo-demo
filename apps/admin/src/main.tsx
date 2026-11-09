import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { httpApi } from './api';
import { App } from './app';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App api={httpApi(import.meta.env.VITE_API_URL ?? '/api')} />
  </StrictMode>,
);
