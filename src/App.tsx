import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { MockToastProvider } from './lib/mock-toast-context';
import { MockToast } from './components/MockToast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CustomerNew } from './pages/CustomerNew';
import { CustomerProfile } from './pages/CustomerProfile';
import { CustomerEdit } from './pages/CustomerEdit';
import { UAT } from './pages/UAT';
import { ImportList } from './pages/import/ImportList';
import { ImportNew } from './pages/import/ImportNew';
import { ImportReview } from './pages/import/ImportReview';
import { ImportCustomerEditor } from './pages/import/ImportCustomerEditor';
import { OutreachDashboard } from './pages/import/OutreachDashboard';
import { ImportPipelineDocs } from './pages/import/ImportPipelineDocs';
import { CustomerRecovery } from './pages/import/CustomerRecovery';

function App() {
  return (
    <MockToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Public customer self-recovery page — token-gated, no auth. */}
            <Route path="/recover/:token" element={<CustomerRecovery />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/customers/new"
              element={
                <ProtectedRoute>
                  <CustomerNew />
                </ProtectedRoute>
              }
            />

            <Route
              path="/customers/:email"
              element={
                <ProtectedRoute>
                  <CustomerProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/customers/:email/edit"
              element={
                <ProtectedRoute>
                  <CustomerEdit />
                </ProtectedRoute>
              }
            />

            <Route
              path="/uat"
              element={
                <ProtectedRoute>
                  <UAT />
                </ProtectedRoute>
              }
            />

            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <ImportList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import-docs"
              element={
                <ProtectedRoute>
                  <ImportPipelineDocs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import/new"
              element={
                <ProtectedRoute>
                  <ImportNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import/:importId"
              element={
                <ProtectedRoute>
                  <ImportReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import/:importId/outreach"
              element={
                <ProtectedRoute>
                  <OutreachDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import/:importId/customer/:customerNo"
              element={
                <ProtectedRoute>
                  <ImportCustomerEditor />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <MockToast />
    </MockToastProvider>
  );
}

export default App;
