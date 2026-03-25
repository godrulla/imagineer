import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { toast } from 'react-hot-toast'
import { authService } from '../lib/api'
import type { AuthUser, Organization, LoginRequest, RegisterRequest } from '../lib/api'

interface AuthContextType {
  user: AuthUser | null
  organizations: Organization[]
  currentOrganization: Organization | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Authentication methods
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  
  // User management
  updateProfile: (data: {
    name?: string
    email?: string
    avatar_url?: string
    preferences?: Record<string, any>
  }) => Promise<void>
  uploadAvatar: (file: File) => Promise<void>
  
  // Organization management
  switchOrganization: (organizationId: string) => Promise<void>
  createOrganization: (data: {
    name: string
    slug?: string
    plan?: 'free' | 'pro' | 'enterprise'
  }) => Promise<void>
  
  // Refresh user data
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = authService.isAuthenticated()

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth()
  }, [])

  // Update current organization when user changes
  useEffect(() => {
    if (user && user.organizations.length > 0) {
      const current = user.organizations.find(
        org => org.id === user.current_organization_id
      ) || user.organizations[0]
      setCurrentOrganization(current)
      setOrganizations(user.organizations)
    }
  }, [user])

  const initializeAuth = async () => {
    setIsLoading(true)
    try {
      if (authService.isAuthenticated()) {
        await refreshUser()
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      // Clear invalid tokens
      authService.logout()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true)
    try {
      const result = await authService.login(credentials)
      setUser(result.user)
      toast.success(`Welcome back, ${result.user.name}!`)
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Login failed'
      toast.error(message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (data: RegisterRequest) => {
    setIsLoading(true)
    try {
      const result = await authService.register(data)
      setUser(result.user)
      toast.success(`Welcome to Imagineer, ${result.user.name}!`)
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Registration failed'
      toast.error(message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      await authService.logout()
      setUser(null)
      setOrganizations([])
      setCurrentOrganization(null)
      toast.success('Logged out successfully')
    } catch (error: any) {
      console.error('Logout error:', error)
      // Still clear local state even if API call fails
      setUser(null)
      setOrganizations([])
      setCurrentOrganization(null)
    } finally {
      setIsLoading(false)
    }
  }

  const forgotPassword = async (email: string) => {
    try {
      const result = await authService.forgotPassword(email)
      toast.success(result.message)
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to send reset email'
      toast.error(message)
      throw error
    }
  }

  const resetPassword = async (token: string, password: string) => {
    try {
      const result = await authService.resetPassword(token, password)
      toast.success(result.message)
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to reset password'
      toast.error(message)
      throw error
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const result = await authService.changePassword(currentPassword, newPassword)
      toast.success(result.message)
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to change password'
      toast.error(message)
      throw error
    }
  }

  const updateProfile = async (data: {
    name?: string
    email?: string
    avatar_url?: string
    preferences?: Record<string, any>
  }) => {
    try {
      const updatedUser = await authService.updateProfile(data)
      setUser(updatedUser)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to update profile'
      toast.error(message)
      throw error
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      const result = await authService.uploadAvatar(file)
      if (user) {
        setUser({ ...user, avatar_url: result.avatar_url })
      }
      toast.success('Avatar updated successfully')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to upload avatar'
      toast.error(message)
      throw error
    }
  }

  const switchOrganization = async (organizationId: string) => {
    try {
      const updatedUser = await authService.switchOrganization(organizationId)
      setUser(updatedUser)
      toast.success('Organization switched successfully')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to switch organization'
      toast.error(message)
      throw error
    }
  }

  const createOrganization = async (data: {
    name: string
    slug?: string
    plan?: 'free' | 'pro' | 'enterprise'
  }) => {
    try {
      await authService.createOrganization(data)
      // Refresh user data to get updated organizations
      await refreshUser()
      toast.success('Organization created successfully')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to create organization'
      toast.error(message)
      throw error
    }
  }

  const refreshUser = async () => {
    try {
      const updatedUser = await authService.getCurrentUser()
      setUser(updatedUser)
    } catch (error: any) {
      console.error('Failed to refresh user:', error)
      throw error
    }
  }

  const value: AuthContextType = {
    user,
    organizations,
    currentOrganization,
    isLoading,
    isAuthenticated,
    
    // Authentication methods
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    
    // User management
    updateProfile,
    uploadAvatar,
    
    // Organization management
    switchOrganization,
    createOrganization,
    
    // Refresh
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}