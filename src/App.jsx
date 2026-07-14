import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ThemeToggle from './components/ThemeToggle'

// Student pages
import LoginPage           from './pages/LoginPage'
import WelcomePage         from './pages/WelcomePage'
import ChallengePage       from './pages/ChallengePage'
import CoursesPage         from './pages/CoursesPage'
import SectionListPage     from './pages/SectionListPage'
import SectionAttemptPage  from './pages/SectionAttemptPage'
import PerformanceReportPage from './pages/PerformanceReportPage'
import LeaderboardPage     from './pages/LeaderboardPage'
import NotFoundPage        from './pages/NotFoundPage'
import StudentProfilePage  from './pages/StudentProfilePage'

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
      <Route path="/courses"    element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />

      {/* Day → Section List → Section Attempt → Report */}
      <Route path="/challenge/day/:dayNumber/sections"                    element={<ProtectedRoute><SectionListPage /></ProtectedRoute>} />
      <Route path="/challenge/day/:dayNumber/sections/:section"            element={<ProtectedRoute><SectionAttemptPage /></ProtectedRoute>} />
      <Route path="/challenge/day/:dayNumber/report"                       element={<ProtectedRoute><PerformanceReportPage /></ProtectedRoute>} />

      <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
      <Route path="/profile"     element={<ProtectedRoute><StudentProfilePage /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin"           element={<Navigate to="/" replace />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />

      {/* Teacher */}
      <Route path="/teacher"           element={<Navigate to="/" replace />} />
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
        {/* Global Premium Ambient Background Orbs */}
        <div className="orb orb-orange" style={{ top: '-15%', left: '-15%', width: '600px', height: '600px', opacity: 0.25 }} />
        <div className="orb orb-violet" style={{ bottom: '-10%', right: '-10%', width: '500px', height: '500px', opacity: 0.2 }} />
        <div className="orb orb-teal" style={{ top: '35%', left: '75%', width: '450px', height: '450px', opacity: 0.15 }} />
        
        <AppRoutes />
        <ThemeToggle />
      </AuthProvider>
    </BrowserRouter>
  )
}

