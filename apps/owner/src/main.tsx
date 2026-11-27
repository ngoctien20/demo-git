import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PilotStore } from './pages/PilotStore';
import './app.css';

createRoot(document.getElementById('root')!).render(<StrictMode>{location.pathname.startsWith('/qa-store/') ? <PilotStore /> : <App />}</StrictMode>);
