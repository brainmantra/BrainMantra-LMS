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
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  if (student) {
    navigate('/challenge', { replace: true })
    return null
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const res = await api.post('/students/login', { mobile })
      login(res.data.student)
      toast.success(`Welcome back, ${res.data.student.name}!`)
      navigate('/welcome')
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
        setNotFound(true)
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
              Enter the mobile number you registered with to access your challenge.
            </p>
          </div>

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="mobile">Mobile Number</label>
              <input
                id="mobile"
                className="form-input"
                type="tel"
                placeholder="10-digit registered mobile"
                maxLength={10}
                value={mobile}
                onChange={e => {
                  setMobile(e.target.value.replace(/\D/g, ''))
                  setNotFound(false)
                }}
                autoFocus
              />
            </div>

            {notFound && (
              <div className="login-not-found animate-fade">
                <div className="login-not-found-icon">⚠</div>
                <div>
                  <p className="login-not-found-title">Mobile number not found</p>
                  <p className="login-not-found-text">
                    This number isn't registered in our system. If you haven't enrolled yet,
                    please fill in the registration form first — your teacher will share the link.
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
              disabled={loading || mobile.length < 10}
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
