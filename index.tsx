import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthGate } from './src/components/AuthGate';
import { ToastProvider } from './src/components/ui/ToastProvider';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UnifiedCheckoutComponent } from './src/components/UnifiedCheckoutComponent';
import { PaymentSuccess } from './src/components/PaymentSuccess';
import { PaymentPending } from './src/components/PaymentPending';
import { BillingPage } from './src/pages/BillingPage';
import { LandingPage } from './src/components/LandingPage';
import { LPForm } from './src/components/LPForm';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { FormOrderAuth } from './src/pages/FormOrderAuth';

// Admin Imports
import AdminGate from './src/components/AdminGate';
import { AdminLayout } from './src/pages/admin/AdminLayout';
import { AdminOverview } from './src/pages/admin/AdminOverview';
import { AdminUsers } from './src/pages/admin/AdminUsers';
import { AdminApiKeys } from './src/pages/admin/AdminApiKeys';
import { AdminPaymentGateway } from './src/pages/admin/AdminPaymentGateway';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/lpform" element={<LPForm />} />
            <Route path="/dashboard" element={
              <AuthGate>
                {(user) => <App user={user} />}
              </AuthGate>
            } />
            <Route path="/formorder" element={<UnifiedCheckoutComponent />} />
            <Route path="/formorderauth" element={<FormOrderAuth />} />
            <Route path="/success" element={<PaymentSuccess />} />
            <Route path="/pending" element={<PaymentPending />} />
            <Route path="/billing" element={<BillingPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminGate />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="api-keys" element={<AdminApiKeys />} />
                <Route path="payment-gateway" element={<AdminPaymentGateway />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);