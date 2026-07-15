import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../utils/api'
import toast from 'react-hot-toast'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please fill all fields.')
    setLoading(true)
    try {
      const res = await adminApi.post('/admin/login', { email, password })
      localStorage.setItem('abacus_admin_token', res.data.token)
      toast.success('Welcome back!')
      navigate('/admin/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page-bg-dots" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card animate-pop" style={{ maxWidth: 400, width: '100%', margin: '1rem', padding: '2.5rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, var(--admin-primary), #d4a017)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 4px 24px var(--admin-glow)',
          }}>
            🛡️
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Admin Login</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Brain Mantra</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" placeholder="admin@school.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-admin btn-block btn-lg" disabled={loading}>
            {loading ? <div className="spinner spinner-sm" /> : 'Sign In →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <a href="/teacher" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Teacher? Click here →
          </a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>
            ← Back to Main
          </button>
        </div>
      </div>
    </div>
  )
}
