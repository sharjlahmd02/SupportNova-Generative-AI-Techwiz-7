import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './routes/Login'
import { CustomerDashboard } from './routes/customer/Dashboard'
import { AgentDashboard } from './routes/agent/Dashboard'
import { AdminDashboard } from './routes/admin/Dashboard'
import { ReviewerQueue } from './routes/reviewer/Queue'
import { ComplaintNew } from './routes/complaints/New'
import { ComplaintDetail } from './routes/complaints/Detail'
import ProtectedRoute from './components/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { SkeletonCard } from './components/ui'

/** Layout route: hands every authenticated page the sidebar + topbar shell. */
function ShellLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <SkeletonCard />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <AppShell />
}

function App() {
  const { user, homePath } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <Login />} />
      <Route path="/" element={<Navigate to={user ? homePath : '/login'} replace />} />

      <Route element={<ShellLayout />}>
        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute allowedRoles={['customer', 'agent', 'reviewer', 'manager', 'admin']}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent/dashboard"
          element={
            <ProtectedRoute allowedRoles={['agent', 'manager', 'admin']}>
              <AgentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reviewer/queue"
          element={
            <ProtectedRoute allowedRoles={['reviewer', 'manager', 'admin']}>
              <ReviewerQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/complaints/new"
          element={
            <ProtectedRoute allowedRoles={['customer', 'agent', 'reviewer', 'manager', 'admin']}>
              <ComplaintNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/complaints/:id"
          element={
            <ProtectedRoute allowedRoles={['customer', 'agent', 'reviewer', 'manager', 'admin']}>
              <ComplaintDetail />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={user ? homePath : '/login'} replace />} />
    </Routes>
  )
}

export default App
