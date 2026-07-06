import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ThemeToggle from './components/ThemeToggle'

// Student pages
import LoginPage           from './pages/LoginPage'
import WelcomePage         from './pages/WelcomePage'
import ChallengePage       from './pages/ChallengePage'
import SectionListPage     from './pages/SectionListPage'
import SectionAttemptPage  from './pages/SectionAttemptPage'
import PerformanceReportPage from './pages/PerformanceReportPage'
import LeaderboardPage     from './pages/LeaderboardPage'
import NotFoundPage        from './pages/NotFoundPage'

// Staff pages
import AdminLogin          from './pages/AdminLogin'
import AdminDashboard      from './pages/AdminDashboard'
import TeacherLogin        from './pages/TeacherLogin'
import TeacherDashboard    from './pages/TeacherDashboard'

function ProtectedRoute({ children }) {
  const { student, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }
  if (!student) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Student */}
      <Route path="/"           element={<LoginPage />} />
      <Route path="/welcome"    element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />
      <Route path="/challenge"  element={<ProtectedRoute><ChallengePage /></ProtectedRoute>} />

      {/* Day → Section List → Section Attempt → Report */}
      <Route path="/challenge/day/:dayNumber/sections"                    element={<ProtectedRoute><SectionListPage /></ProtectedRoute>} />
      <Route path="/challenge/day/:dayNumber/sections/:section"            element={<ProtectedRoute><SectionAttemptPage /></ProtectedRoute>} />
      <Route path="/challenge/day/:dayNumber/report"                       element={<ProtectedRoute><PerformanceReportPage /></ProtectedRoute>} />

      <Route path="/leaderboard" element={<LeaderboardPage />} />

      {/* Admin */}
      <Route path="/admin"           element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />

      {/* Teacher */}
      <Route path="/teacher"           element={<TeacherLogin />} />
      <Route path="/teacher/dashboard" element={<TeacherDashboard />} />

      <Route path="*" element={<NotFoundPage />} />
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
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow-lg)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <AppRoutes />
        <ThemeToggle />
      </AuthProvider>
    </BrowserRouter>
  )
}

