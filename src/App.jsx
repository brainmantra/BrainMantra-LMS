import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

import LoginPage        from './pages/LoginPage'
import WelcomePage      from './pages/WelcomePage'
import ChallengePage    from './pages/ChallengePage'
import DayModal         from './pages/DayModal'
import LeaderboardPage  from './pages/LeaderboardPage'
import NotFoundPage     from './pages/NotFoundPage'

function ProtectedRoute({ children }) {
  const { student, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  )
  if (!student) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"         element={<LoginPage />} />
      <Route path="/welcome"  element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />
      <Route path="/challenge" element={<ProtectedRoute><ChallengePage /></ProtectedRoute>} />
      <Route path="/challenge/day/:dayNumber" element={<ProtectedRoute><DayModal /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="*"         element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--navy)',
              color: 'var(--ivory)',
            },
            success: { iconTheme: { primary: '#27ae60', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#e8453c', secondary: '#fff' } },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
