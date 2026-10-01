import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './styles/auth.css';
import './styles/dashboard.css';
import './styles/autotrack-theme.css';

createRoot(document.getElementById('root')!).render(<App />);
