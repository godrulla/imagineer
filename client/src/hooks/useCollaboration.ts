import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { collaborationHubService } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useAppStore } from '../stores/appStore'
import type { 
  CollaborationSession, 
  SessionParticipant,
  WebSocketMessage,
  Position 
} from '../lib/api'

interface UseCollaborationOptions {
  projectId?: string
  designFileId?: string
  sessionType?: 'design_editing' | 'review' | 'translation'
  autoConnect?: boolean
}

interface CollaborationState {
  isConnected: boolean
  isConnecting: boolean
  session: CollaborationSession | null
  participants: SessionParticipant[]
  onlineUsers: Record<string, {
    user_id: string
    user_name: string
    avatar_url?: string
    cursor_position?: Position
    selected_elements?: string[]
    is_online: boolean
    color: string
  }>
  error: string | null
}

export function useCollaboration(options: UseCollaborationOptions = {}) {
  const { 
    projectId, 
    designFileId, 
    sessionType = 'design_editing',
    autoConnect = false 
  } = options

  const { user } = useAuth()
  const { 
    startCollaboration, 
    stopCollaboration, 
    updateOnlineUsers,
    selectedElements 
  } = useAppStore()

  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isConnecting: false,
    session: null,
    participants: [],
    onlineUsers: {},
    error: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const sessionRef = useRef<CollaborationSession | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)

  // Create session
  const createSession = useCallback(async () => {
    if (!projectId || !user) return null

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }))
      
      const session = await collaborationHubService.createSession({
        project_id: projectId,
        design_file_id: designFileId,
        session_type: sessionType,
      })

      sessionRef.current = session
      setState(prev => ({ ...prev, session }))
      
      return session
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to create session'
      setState(prev => ({ ...prev, error: message }))
      toast.error(message)
      return null
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }))
    }
  }, [projectId, designFileId, sessionType, user])

  // Join existing session
  const joinSession = useCallback(async (sessionId: string) => {
    if (!user) return false

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }))
      
      const result = await collaborationHubService.joinSession(sessionId)
      
      sessionRef.current = result.session
      setState(prev => ({ 
        ...prev, 
        session: result.session,
        participants: result.session.participants 
      }))
      
      return true
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to join session'
      setState(prev => ({ ...prev, error: message }))
      toast.error(message)
      return false
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }))
    }
  }, [user])

  // Connect WebSocket
  const connectWebSocket = useCallback(async (session: CollaborationSession) => {
    if (!user || wsRef.current) return

    try {
      const ws = await collaborationHubService.connectWebSocket(`/sessions/${session.id}`)
      wsRef.current = ws

      // Set up event listeners
      collaborationHubService.addEventListener(session.id, 'cursor_update', (message: any) => {
        if (message.payload?.user_id !== user.id) {
          setState(prev => ({
            ...prev,
            onlineUsers: {
              ...prev.onlineUsers,
              [message.payload.user_id]: {
                ...prev.onlineUsers[message.payload.user_id],
                cursor_position: message.payload.position,
              }
            }
          }))
        }
      })

      collaborationHubService.addEventListener(session.id, 'selection_update', (message: any) => {
        if (message.payload?.user_id !== user.id) {
          setState(prev => ({
            ...prev,
            onlineUsers: {
              ...prev.onlineUsers,
              [message.payload.user_id]: {
                ...prev.onlineUsers[message.payload.user_id],
                selected_elements: message.payload.selected_elements,
              }
            }
          }))
        }
      })

      collaborationHubService.addEventListener(session.id, 'user_joined', (message: any) => {
        toast.success(`${message.payload.user_name} joined the session`)
        refreshParticipants()
      })

      collaborationHubService.addEventListener(session.id, 'user_left', (message: any) => {
        toast.info(`${message.payload.user_name} left the session`)
        refreshParticipants()
      })

      collaborationHubService.addEventListener(session.id, 'disconnect', () => {
        setState(prev => ({ ...prev, isConnected: false }))
        handleReconnect()
      })

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)

      setState(prev => ({ ...prev, isConnected: true, error: null }))
      startCollaboration(session.id)
      reconnectAttempts.current = 0

    } catch (error: any) {
      console.error('WebSocket connection failed:', error)
      setState(prev => ({ ...prev, error: 'Connection failed' }))
      handleReconnect()
    }
  }, [user, startCollaboration])

  // Handle reconnection
  const handleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= 5) {
      setState(prev => ({ ...prev, error: 'Connection lost. Please refresh the page.' }))
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
    reconnectAttempts.current++

    reconnectRef.current = setTimeout(() => {
      if (sessionRef.current && user) {
        connectWebSocket(sessionRef.current)
      }
    }, delay)
  }, [connectWebSocket, user])

  // Refresh participants
  const refreshParticipants = useCallback(async () => {
    if (!sessionRef.current) return

    try {
      const [participants, presence] = await Promise.all([
        collaborationHubService.getSessionParticipants(sessionRef.current.id),
        collaborationHubService.getPresence(sessionRef.current.id),
      ])

      setState(prev => ({ ...prev, participants }))

      // Update online users with presence data
      const onlineUsers = Object.entries(presence).reduce((acc, [userId, userData]) => {
        acc[userId] = {
          ...userData,
          color: collaborationHubService.getParticipantColor(userId),
        }
        return acc
      }, {} as CollaborationState['onlineUsers'])

      setState(prev => ({ ...prev, onlineUsers }))
      updateOnlineUsers(Object.values(onlineUsers))

    } catch (error) {
      console.error('Failed to refresh participants:', error)
    }
  }, [updateOnlineUsers])

  // Send cursor position
  const sendCursorPosition = useCallback((position: Position) => {
    if (sessionRef.current && state.isConnected) {
      collaborationHubService.sendCursorUpdate(sessionRef.current.id, position)
    }
  }, [state.isConnected])

  // Send selection update
  const sendSelectionUpdate = useCallback((elements: string[]) => {
    if (sessionRef.current && state.isConnected) {
      collaborationHubService.sendSelectionUpdate(sessionRef.current.id, elements)
    }
  }, [state.isConnected])

  // Send element update
  const sendElementUpdate = useCallback((elementId: string, changes: Record<string, any>) => {
    if (sessionRef.current && state.isConnected) {
      collaborationHubService.sendElementUpdate(sessionRef.current.id, elementId, changes)
    }
  }, [state.isConnected])

  // Send comment
  const sendComment = useCallback((content: string, position: Position) => {
    if (sessionRef.current && state.isConnected) {
      collaborationHubService.sendComment(sessionRef.current.id, content, position)
    }
  }, [state.isConnected])

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      // Clear timers
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }

      // Leave session
      if (sessionRef.current) {
        await collaborationHubService.leaveSession(sessionRef.current.id)
        collaborationHubService.cleanup(sessionRef.current.id)
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      // Reset state
      setState({
        isConnected: false,
        isConnecting: false,
        session: null,
        participants: [],
        onlineUsers: {},
        error: null,
      })

      sessionRef.current = null
      reconnectAttempts.current = 0
      stopCollaboration()

    } catch (error) {
      console.error('Error during disconnect:', error)
    }
  }, [stopCollaboration])

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && projectId && user && !sessionRef.current) {
      createSession().then(session => {
        if (session) {
          connectWebSocket(session)
        }
      })
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, projectId, user, createSession, connectWebSocket, disconnect])

  // Send selection updates
  useEffect(() => {
    if (state.isConnected && selectedElements.length > 0) {
      sendSelectionUpdate(selectedElements)
    }
  }, [selectedElements, state.isConnected, sendSelectionUpdate])

  return {
    // State
    ...state,
    
    // Actions
    createSession,
    joinSession,
    disconnect,
    
    // Real-time actions
    sendCursorPosition,
    sendSelectionUpdate,
    sendElementUpdate,
    sendComment,
    
    // Utils
    refreshParticipants,
    
    // Session management
    session: sessionRef.current,
  }
}