import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { Login } from '@/features/auth/Login'
import { SharedLoginPage } from '@/features/shared/SharedLoginPage'
import { SharedCrmPage } from '@/features/shared/SharedCrmPage'
import { useAuthStore } from '@/store/useAuthStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Acesso externo ao CRM — sessão isolada, fora do ProtectedRoute */}
        <Route path="/shared"     element={<SharedLoginPage />} />
        <Route path="/shared/crm" element={<SharedCrmPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
