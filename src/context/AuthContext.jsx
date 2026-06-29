import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('abacus_student')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setStudent(parsed)
        // Verify with backend silently
        api.get(`/students/${parsed._id}`).then(res => {
          setStudent(res.data)
          localStorage.setItem('abacus_student', JSON.stringify(res.data))
        }).catch(() => {
          // Token invalid or student not found
          localStorage.removeItem('abacus_student')
          setStudent(null)
        })
      } catch {
        localStorage.removeItem('abacus_student')
      }
    }
    setLoading(false)
  }, [])

  const login = (studentData) => {
    setStudent(studentData)
    localStorage.setItem('abacus_student', JSON.stringify(studentData))
  }

  const logout = () => {
    setStudent(null)
    localStorage.removeItem('abacus_student')
  }

  return (
    <AuthContext.Provider value={{ student, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}