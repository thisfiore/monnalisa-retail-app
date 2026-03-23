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

function App() {
  return (
    <MockToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <MockToast />
    </MockToastProvider>
  );
}

export default App;
