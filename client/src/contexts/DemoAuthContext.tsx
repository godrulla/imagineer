import { createContext, useContext, useState, ReactNode } from 'react'

interface DemoAuthContextType {
  user: any
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const DemoAuthContext = createContext<DemoAuthContextType | undefined>(undefined)

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>({
    id: '1',
    name: 'Armando Diaz',
    email: 'armando@exxede.com',
    role: 'admin'
  })
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [isLoading] = useState(false)

  const login = async (email: string, password: string) => {
    // Demo login - always succeeds
    setUser({
      id: '1',
      name: 'Armando Diaz',
      email: email,
      role: 'admin'
    })
    setIsAuthenticated(true)
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <DemoAuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      login,
      logout
    }}>
      {children}
    </DemoAuthContext.Provider>
  )
}

export const useDemoAuth = () => {
  const context = useContext(DemoAuthContext)
  if (!context) {
    throw new Error('useDemoAuth must be used within DemoAuthProvider')
  }
  return context
}