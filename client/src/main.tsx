import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PointagePage } from '@/pages/PointagePage';
import { AdminPointagesPage } from '@/pages/AdminPointagesPage';
import { SalariesPage } from '@/pages/SalariesPage';
import { ProjetsPage } from '@/pages/ProjetsPage';
import './index.css';
import { ClientsPage } from '@/pages/ClientsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Route protégée
const ProtectedRoute = ({ 
  children, 
  adminOnly = false,
  managerOnly = false,
  noAdmin = false,
}: { 
  children: React.ReactNode; 
  adminOnly?: boolean;
  managerOnly?: boolean;
  noAdmin?: boolean;
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Empêcher l'admin d'accéder (ex: page pointage)
  if (noAdmin && user?.role === 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (adminOnly && user?.role !== 'Admin') {
    return <Navigate to="/pointage" replace />;
  }

  if (managerOnly && user?.role === 'Salarie') {
    return <Navigate to="/pointage" replace />;
  }

  return <Layout>{children}</Layout>;
};

// App
const App = () => {
  const { isAuthenticated, user } = useAuthStore();

  // Redirection par défaut selon le rôle
  const getDefaultRoute = () => {
    if (!user) return '/login';
    if (user.role === 'Admin') return '/dashboard'; // Admin → Dashboard (pas pointage)
    if (user.role === 'Manager') return '/dashboard';
    return '/pointage'; // Salarié → Pointage
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Route publique */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={getDefaultRoute()} replace />
            ) : (
              <LoginPage />
            )
          }
        />

        {/* Routes protégées */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute managerOnly>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        
        {/* Pointage salarié - INTERDIT à l'Admin */}
        <Route
          path="/pointage"
          element={
            <ProtectedRoute noAdmin>
              <PointagePage />
            </ProtectedRoute>
          }
        />
        
        {/* Gestion pointages Admin/Manager */}
        <Route
          path="/validations"
          element={
            <ProtectedRoute managerOnly>
              <AdminPointagesPage />
            </ProtectedRoute>
          }
        />
        
        {/* Gestion Salariés - Admin only */}
        <Route
          path="/salaries"
          element={
            <ProtectedRoute adminOnly>
              <SalariesPage />
            </ProtectedRoute>
          }
        />
        
        {/* Gestion Projets - Admin only */}
        <Route
          path="/projets"
          element={
            <ProtectedRoute adminOnly>
              <ProjetsPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/clients"
          element={
            <ProtectedRoute adminOnly>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/conges"
          element={
            <ProtectedRoute>
              <div className="text-center py-12 text-gray-500">Page Congés - En développement</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <div className="text-center py-12 text-gray-500">Page Paramètres - En développement</div>
            </ProtectedRoute>
          }
        />

        {/* Redirections */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

// Render
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#fff',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
