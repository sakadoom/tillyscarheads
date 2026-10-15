import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Compass, LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';

import { ToastProvider } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { Card, EmptyState } from './components/ui/Card';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AnalysisPage } from './pages/AnalysisPage';
import { CalendarPage } from './pages/CalendarPage';
import { GanttPage } from './pages/GanttPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RegisterPage } from './pages/RegisterPage';
import { TeamPage } from './pages/TeamPage';

function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <p className="flex items-center gap-2 text-body-sm text-ink-3">
        <LoaderCircle aria-hidden className="size-5 animate-spin" />
        Menyiapkan sesi…
      </p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to="/projects" replace />;
  return <>{children}</>;
}

function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <EmptyState
          icon={Compass}
          title="Halaman tidak ditemukan"
          description="Alamat yang Anda buka tidak tersedia. Kembali ke daftar proyek untuk melanjutkan."
          action={
            <Link to="/projects">
              <Button variant="primary">Ke daftar proyek</Button>
            </Link>
          }
        />
      </Card>
    </main>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicOnlyRoute>
                    <RegisterPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute>
                    <ProjectsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:id/gantt"
                element={
                  <ProtectedRoute>
                    <GanttPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:id/team"
                element={
                  <ProtectedRoute>
                    <TeamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:id/calendar"
                element={
                  <ProtectedRoute>
                    <CalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:id/analysis"
                element={
                  <ProtectedRoute>
                    <AnalysisPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
