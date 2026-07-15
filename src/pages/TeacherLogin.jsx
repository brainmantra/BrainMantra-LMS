import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { teacherApi } from '../utils/api'
import toast from 'react-hot-toast'

export default function TeacherLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please fill in all fields.')
    setLoading(true)
    try {
      const res = await teacherApi.post('/teachers/login', { email, password })
      localStorage.setItem('abacus_teacher_token', res.data.token)
      localStorage.setItem('abacus_teacher', JSON.stringify(res.data.teacher))
      navigate('/teacher/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page-bg-dots" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card animate-pop" style={{ maxWidth: 420, width: '100%', margin: '1rem', padding: '2.5rem' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, var(--teacher-primary), #0077b6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 4px 24px var(--teacher-glow)',
          }}>
            👨‍🏫
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Teacher Portal</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Brain Mantra</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email" placeholder="you@school.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-block"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, var(--teacher-primary), #0077b6)',
              color: '#fff', boxShadow: '0 4px 20px var(--teacher-glow)',
              padding: '0.85rem', fontSize: '1rem',
            }}
          >
            {loading ? <div className="spinner spinner-sm" /> : 'Sign In →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <a href="/admin" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Admin? Click here →
          </a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>
            ← Back to Main
          </button>
        </div>
      </div>
    </div>
  )
}
