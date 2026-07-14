import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { REGISTRATION_FORM_URL } from '../utils/formsConfig'
import api from '../utils/api'
import toast from 'react-hot-toast'
import './LoginPage.css'

export default function LoginPage() {
  const { login, student } = useAuth()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  if (student) {
    navigate('/challenge', { replace: true })
    return null
  }

  // Auto redirect if other roles are already logged in
  const adminToken = localStorage.getItem('abacus_admin_token')
  if (adminToken) {
    navigate('/admin/dashboard', { replace: true })
    return null
  }
  const teacherToken = localStorage.getItem('abacus_teacher_token')
  if (teacherToken) {
    navigate('/teacher/dashboard', { replace: true })
    return null
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginId.trim() || !password.trim()) {
      toast.error('Please enter both Login ID and password')
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const res = await api.post('/auth/login', { loginId, password })
      
      const { role, token, user, redirectUrl } = res.data

      if (role === 'admin') {
        localStorage.setItem('abacus_admin_token', token)
        toast.success('Welcome back, Admin!')
        navigate(redirectUrl)
      } else if (role === 'teacher') {
        localStorage.setItem('abacus_teacher_token', token)
        localStorage.setItem('abacus_teacher', JSON.stringify(user))
        toast.success(`Welcome back, Teacher ${user.name}!`)
        navigate(redirectUrl)
      } else if (role === 'student') {
        login(user)
        toast.success(`Welcome back, ${user.name}!`)
        navigate(redirectUrl)
      } else {
        throw new Error('Unknown user role.')
      }

    } catch (err) {
      console.error('[Login Error]', err)
      const status = err.response?.status
      
      if (status === 401) {
        setNotFound(true)
      } else if (err.response?.data?.message) {
        toast.error(err.response.data.message)
      } else if (err.message) {
        toast.error(err.message)
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bead-bar login-bead-bar--top" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={`lbead lbead--${i % 3}`} style={{ '--i': i }} />
        ))}
      </div>

      <div className="login-layout">
        {/* Brand panel */}
        <div className="login-brand animate-fade">
          <div className="login-brand-logo">
            <img src="/brand-logo.jpeg" alt="Brain Mantra Logo" style={{ width: 56, height: 56, borderRadius: 14 }} />
          </div>
          <h1 className="login-brand-title">Brain Mantra</h1>
          <p className="login-brand-tagline">
            Build lightning-fast mental math skills, one day at a time.
          </p>
          <div className="login-brand-stats">
            <div className="lstat"><span className="lstat-num">100</span><span className="lstat-label">Daily challenges</span></div>
            <div className="lstat"><span className="lstat-num">5</span><span className="lstat-label">Skill levels</span></div>
            <div className="lstat"><span className="lstat-num">🔥</span><span className="lstat-label">Streak tracking</span></div>
          </div>
        </div>

        {/* Login form panel */}
        <div className="login-form-panel animate-pop">
          <div className="login-form-header">
            <h2 className="login-form-title">Unified Login Portal</h2>
            <p className="login-form-subtitle">
              Enter your login ID and password to access your dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="loginId">Login ID</label>
              <input
                id="loginId"
                className="input-premium"
                type="text"
                placeholder="Username, email, or mobile"
                value={loginId}
                onChange={e => {
                  setLoginId(e.target.value)
                  setNotFound(false)
                }}
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input-premium"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {notFound && (
              <div className="login-not-found animate-fade" style={{ marginTop: '1rem' }}>
                <div className="login-not-found-icon">⚠</div>
                <div>
                  <p className="login-not-found-title">Login Failed</p>
                  <p className="login-not-found-text">
                    Invalid Login ID or Password. If you are a student and haven't enrolled yet,
                    please fill in the registration form.
                  </p>
                  <a
                    href={REGISTRATION_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="login-register-link"
                  >
                    Go to Registration Form →
                  </a>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading || !loginId.trim() || !password.trim()}
              style={{ marginTop: '1.5rem' }}
            >
              {loading
                ? <><span className="btn-spinner" /> Signing in…</>
                : 'Sign In →'}
            </button>
          </form>

          <div className="login-footer-note" style={{ marginTop: '1.5rem' }}>
            <p>
              Students: Not registered yet?{' '}
              <a
                href={REGISTRATION_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="login-register-link"
              >
                Fill in the enrollment form
              </a>{' '}
              and ask your teacher to activate your account.
            </p>
          </div>
        </div>
      </div>

      <div className="login-bead-bar login-bead-bar--bottom" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={`lbead lbead--${(i + 1) % 3}`} style={{ '--i': i }} />
        ))}
      </div>
    </div>
  )
}
