import { createRoot } from 'react-dom/client';
import HomePage from '../app/page';
import { PaidPage } from './paid-page';
import '../app/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Storefront root is missing');
const paid = /^\/orders\/(lf_[a-f0-9]{32})\/paid\/?$/.exec(window.location.pathname);
createRoot(root).render(paid ? <PaidPage orderId={paid[1]} /> : <HomePage />);
