import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'gradeSystem'
const CHANGE_EVENT = 'gradeSystemChange'

// Reads/writes the grade system preference from localStorage.
// Any component using this hook will re-render when another component calls setSystem().
export function useGradeSystem() {
  const [system, setSystemState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'V')

  useEffect(() => {
    const handler = () => setSystemState(localStorage.getItem(STORAGE_KEY) || 'V')
    window.addEventListener(CHANGE_EVENT, handler)
    return () => window.removeEventListener(CHANGE_EVENT, handler)
  }, [])

  const setSystem = useCallback((newSystem) => {
    localStorage.setItem(STORAGE_KEY, newSystem)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [system, setSystem]
}
