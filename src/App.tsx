import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/AppLayout';
import { AuthPage } from '@/components/AuthPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdminProvider, useAdmins } from '@/hooks/AdminContext';
import { useAuth } from '@/hooks/AuthContext';
import { AdminPage } from '@/pages/AdminPage';
import { AuditPage } from '@/pages/AuditPage';
import { DataPage } from '@/pages/DataPage';
import { HomePage } from '@/pages/HomePage';

function AdminGuard({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { isAdmin, loading } = useAdmins();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function AuthGuard({
  children,
  requireAuth,
}: {
  children: React.ReactNode;
  requireAuth: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) return <Navigate to="/auth" replace />;
  if (!requireAuth && isAuthenticated) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AdminProvider>
        {/* ensure all new routes require auth */}
        <Routes>
        <Route
          path="/auth"
          element={
            <AuthGuard requireAuth={false}>
              <AuthPage />
            </AuthGuard>
          }
        />
        <Route
          path="/"
          element={
            <AuthGuard requireAuth={true}>
              <AppLayout>
                <HomePage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/data"
          element={
            <AuthGuard requireAuth={true}>
              <AppLayout>
                <DataPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/audit"
          element={
            <AuthGuard requireAuth={true}>
              <AppLayout>
                <AuditPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <AuthGuard requireAuth={true}>
              <AdminGuard>
                <AppLayout>
                  <AdminPage />
                </AppLayout>
              </AdminGuard>
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AdminProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
