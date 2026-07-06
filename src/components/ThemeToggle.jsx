import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(localStorage.getItem('abacus_theme') || 'dark')

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme')
    } else {
      document.documentElement.classList.remove('light-theme')
    }
    localStorage.setItem('abacus_theme', theme)
  }, [theme])

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'var(--bg-elevated)',
        border: '1.5px solid var(--border-strong)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 9999,
        fontSize: '1.25rem',
        transition: 'all var(--trans-fast)',
      }}
      title="Toggle Theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
