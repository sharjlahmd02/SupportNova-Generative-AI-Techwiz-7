import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './routes/Login'
import { CustomerDashboard } from './routes/customer/Dashboard'
import { AgentDashboard } from './routes/agent/Dashboard'
import { AdminDashboard } from './routes/admin/Dashboard'
import { ReviewerQueue } from './routes/reviewer/Queue'
import { ComplaintNew } from './routes/complaints/New'
import { ComplaintDetail } from './routes/complaints/Detail'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

function App() {
  const { user } = useAuth()

  return (
    <div className="app">
      {user && <Navbar />}
      <main className="container">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['customer', 'agent', 'reviewer', 'manager', 'admin']}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/dashboard"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
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
              <ProtectedRoute allowedRoles={['customer', 'agent', 'admin']}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App