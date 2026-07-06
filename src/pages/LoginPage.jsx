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

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginId.trim()) {
      toast.error('Login ID is required')
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const res = await api.post('/students/login', { loginId, password })
      
      // Prevent crashes if the server returns HTML instead of JSON
      if (!res.data || !res.data.student) {
        throw new Error('Invalid response from server. Check API URL configuration.')
      }
      
      login(res.data.student)
      toast.success(`Welcome back, ${res.data.student.name}!`)
      navigate('/welcome')
    } catch (err) {
      console.error('[Login Error]', err)
      const status = err.response?.status
      
      if (status === 404) {
        setNotFound(true)
      } else if (err.response?.data?.message) {
        // Show the exact error message thrown by the backend (e.g. Invalid Level, 503, etc)
        toast.error(err.response.data.message)
      } else if (err.message) {
        // Show network errors or our custom thrown error
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
            <svg width="56" height="56" viewBox="0 0 52 52" fill="none">
              <rect width="52" height="52" rx="14" fill="#f5a623"/>
              <rect x="10" y="14" width="32" height="3" rx="1.5" fill="#1a2340"/>
              <rect x="10" y="24.5" width="32" height="3" rx="1.5" fill="#1a2340"/>
              <rect x="10" y="35" width="32" height="3" rx="1.5" fill="#1a2340"/>
              <circle cx="19" cy="15.5" r="5" fill="#1a2340"/>
              <circle cx="29" cy="26" r="5" fill="#1a2340"/>
              <circle cx="22" cy="36.5" r="5" fill="#1a2340"/>
              <circle cx="35" cy="15.5" r="5" fill="white" opacity="0.45"/>
              <circle cx="14" cy="26" r="5" fill="white" opacity="0.45"/>
              <circle cx="36" cy="36.5" r="5" fill="white" opacity="0.45"/>
            </svg>
          </div>
          <h1 className="login-brand-title">100 Days of<br/>Abacus</h1>
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
            <h2 className="login-form-title">Student Login</h2>
            <p className="login-form-subtitle">
              Enter your unique Login ID and Password to access your challenge.
            </p>
          </div>

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="loginId">Login ID</label>
              <input
                id="loginId"
                className="form-input"
                type="text"
                placeholder="Enter your Login ID"
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
                className="form-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {notFound && (
              <div className="login-not-found animate-fade">
                <div className="login-not-found-icon">⚠</div>
                <div>
                  <p className="login-not-found-title">Login Failed</p>
                  <p className="login-not-found-text">
                    Invalid Login ID or Password. If you haven't been assigned credentials yet,
                    please contact your teacher or fill in the registration form.
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
            >
              {loading
                ? <><span className="btn-spinner" /> Verifying…</>
                : 'Continue to Challenge →'}
            </button>
          </form>

          <div className="login-footer-note">
            <p>
              Not registered yet?{' '}
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
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => navigate('/teacher')}
                className="btn btn-ghost" 
                style={{ fontSize: '13px', color: '#666', border: '1px solid #ddd' }}
              >
                Teacher / Admin Login
              </button>
            </div>
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
