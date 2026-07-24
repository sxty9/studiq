import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Which code is this device actually running? iOS Safari will serve a whole cached app from disk
// without a single network request, so the build sha has to be observable from the device itself.
(window as unknown as { studiq: { build: string } }).studiq = { build: __BUILD__ };
console.info(`studiq build ${__BUILD__}`);

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
