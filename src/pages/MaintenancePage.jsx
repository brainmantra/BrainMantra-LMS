import React from 'react'
import './LoginPage.css'

export default function MaintenancePage() {
  return (
    <div className="login-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div 
        className="login-layout"
        style={{
          maxWidth: '560px',
          width: '100%',
          textAlign: 'center',
          padding: '3rem 2rem',
          background: 'rgba(20, 24, 33, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(245, 200, 66, 0.2)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 200, 66, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}
      >
        <div style={{ position: 'relative' }}>
          <img 
            src="/brand-logo.jpeg" 
            alt="Brain Mantra Logo" 
            style={{
              width: '85px', 
              height: '85px', 
              borderRadius: '20px', 
              boxShadow: '0 8px 30px rgba(245, 200, 66, 0.3)',
              border: '2px solid rgba(245, 200, 66, 0.4)'
            }} 
          />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1rem',
          borderRadius: '999px',
          background: 'rgba(245, 200, 66, 0.12)',
          border: '1px solid rgba(245, 200, 66, 0.3)',
          color: 'var(--accent-gold, #f5c842)',
          fontSize: '0.85rem',
          fontWeight: '600',
          letterSpacing: '0.5px'
        }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f5c842', boxShadow: '0 0 8px #f5c842' }} />
          SCHEDULED MAINTENANCE
        </div>

        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '800', 
          margin: 0,
          fontFamily: 'var(--font-display)',
          background: 'linear-gradient(135deg, #ffffff 30%, #fde68a 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          We'll Be Back Soon!
        </h1>

        <p style={{ 
          fontSize: '1.02rem', 
          color: 'var(--text-secondary, #94a3b8)', 
          lineHeight: '1.6', 
          margin: 0,
          maxWidth: '440px'
        }}>
          The <strong>100 Days Abacus Challenge</strong> portal is temporarily undergoing scheduled maintenance and database optimization.
        </p>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          width: '100%',
          textAlign: 'left',
          fontSize: '0.9rem',
          color: '#cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🛡️</span>
            <span>All student <strong>streaks, XP points, and past records</strong> are 100% safe and preserved.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🧮</span>
            <span>Daily challenge access will resume shortly.</span>
          </div>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
          Thank you for your patience! — <strong>Brain Mantra Academy</strong>
        </p>
      </div>
    </div>
  )
}
