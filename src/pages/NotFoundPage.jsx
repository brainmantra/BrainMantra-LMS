import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20, textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800 }}>404</h1>
      <p style={{ color: 'var(--slate)' }}>This page doesn't exist on the abacus board.</p>
      <Link to="/" className="btn btn-primary">Go Home</Link>
    </div>
  )
}
