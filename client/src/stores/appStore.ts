import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Project, DesignFile, ParsedDesign } from '../lib/api'

interface AppState {
  // Current workspace context
  currentProject: Project | null
  currentFile: DesignFile | null
  currentParsedDesign: ParsedDesign | null
  
  // UI state
  sidebarOpen: boolean
  propertiesPanelOpen: boolean
  layersPanelOpen: boolean
  chatPanelOpen: boolean
  
  // Editor state
  selectedElements: string[]
  clipboard: any[]
  zoom: number
  viewportPosition: { x: number; y: number }
  
  // Collaboration state
  isCollaborating: boolean
  collaborationSessionId: string | null
  onlineUsers: Array<{
    id: string
    name: string
    avatar_url?: string
    cursor_position?: { x: number; y: number }
    color: string
  }>
  
  // Loading states
  isLoading: boolean
  loadingMessage: string
  
  // Error state
  error: string | null
  
  // Actions
  setCurrentProject: (project: Project | null) => void
  setCurrentFile: (file: DesignFile | null) => void
  setCurrentParsedDesign: (design: ParsedDesign | null) => void
  
  // UI actions
  toggleSidebar: () => void
  togglePropertiesPanel: () => void
  toggleLayersPanel: () => void
  toggleChatPanel: () => void
  
  // Editor actions
  setSelectedElements: (elements: string[]) => void
  addToSelection: (elementId: string) => void
  removeFromSelection: (elementId: string) => void
  clearSelection: () => void
  copyToClipboard: (elements: any[]) => void
  setZoom: (zoom: number) => void
  setViewportPosition: (position: { x: number; y: number }) => void
  
  // Collaboration actions
  startCollaboration: (sessionId: string) => void
  stopCollaboration: () => void
  updateOnlineUsers: (users: Array<{
    id: string
    name: string
    avatar_url?: string
    cursor_position?: { x: number; y: number }
    color: string
  }>) => void
  
  // Loading actions
  setLoading: (isLoading: boolean, message?: string) => void
  
  // Error actions
  setError: (error: string | null) => void
  clearError: () => void
  
  // Reset actions
  resetWorkspace: () => void
  resetUI: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentProject: null,
        currentFile: null,
        currentParsedDesign: null,
        
        // UI state
        sidebarOpen: true,
        propertiesPanelOpen: true,
        layersPanelOpen: true,
        chatPanelOpen: false,
        
        // Editor state
        selectedElements: [],
        clipboard: [],
        zoom: 1,
        viewportPosition: { x: 0, y: 0 },
        
        // Collaboration state
        isCollaborating: false,
        collaborationSessionId: null,
        onlineUsers: [],
        
        // Loading states
        isLoading: false,
        loadingMessage: '',
        
        // Error state
        error: null,
        
        // Actions
        setCurrentProject: (project) => 
          set({ currentProject: project }, false, 'setCurrentProject'),
        
        setCurrentFile: (file) => 
          set({ currentFile: file }, false, 'setCurrentFile'),
        
        setCurrentParsedDesign: (design) => 
          set({ currentParsedDesign: design }, false, 'setCurrentParsedDesign'),
        
        // UI actions
        toggleSidebar: () => 
          set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar'),
        
        togglePropertiesPanel: () => 
          set((state) => ({ propertiesPanelOpen: !state.propertiesPanelOpen }), false, 'togglePropertiesPanel'),
        
        toggleLayersPanel: () => 
          set((state) => ({ layersPanelOpen: !state.layersPanelOpen }), false, 'toggleLayersPanel'),
        
        toggleChatPanel: () => 
          set((state) => ({ chatPanelOpen: !state.chatPanelOpen }), false, 'toggleChatPanel'),
        
        // Editor actions
        setSelectedElements: (elements) => 
          set({ selectedElements: elements }, false, 'setSelectedElements'),
        
        addToSelection: (elementId) => 
          set((state) => {
            if (!state.selectedElements.includes(elementId)) {
              return { selectedElements: [...state.selectedElements, elementId] }
            }
            return state
          }, false, 'addToSelection'),
        
        removeFromSelection: (elementId) => 
          set((state) => ({
            selectedElements: state.selectedElements.filter(id => id !== elementId)
          }), false, 'removeFromSelection'),
        
        clearSelection: () => 
          set({ selectedElements: [] }, false, 'clearSelection'),
        
        copyToClipboard: (elements) => 
          set({ clipboard: elements }, false, 'copyToClipboard'),
        
        setZoom: (zoom) => 
          set({ zoom: Math.max(0.1, Math.min(5, zoom)) }, false, 'setZoom'),
        
        setViewportPosition: (position) => 
          set({ viewportPosition: position }, false, 'setViewportPosition'),
        
        // Collaboration actions
        startCollaboration: (sessionId) => 
          set({ 
            isCollaborating: true, 
            collaborationSessionId: sessionId 
          }, false, 'startCollaboration'),
        
        stopCollaboration: () => 
          set({ 
            isCollaborating: false, 
            collaborationSessionId: null,
            onlineUsers: []
          }, false, 'stopCollaboration'),
        
        updateOnlineUsers: (users) => 
          set({ onlineUsers: users }, false, 'updateOnlineUsers'),
        
        // Loading actions
        setLoading: (isLoading, message = '') => 
          set({ isLoading, loadingMessage: message }, false, 'setLoading'),
        
        // Error actions
        setError: (error) => 
          set({ error }, false, 'setError'),
        
        clearError: () => 
          set({ error: null }, false, 'clearError'),
        
        // Reset actions
        resetWorkspace: () => 
          set({
            currentProject: null,
            currentFile: null,
            currentParsedDesign: null,
            selectedElements: [],
            clipboard: [],
            zoom: 1,
            viewportPosition: { x: 0, y: 0 },
            isCollaborating: false,
            collaborationSessionId: null,
            onlineUsers: [],
            error: null,
          }, false, 'resetWorkspace'),
        
        resetUI: () => 
          set({
            sidebarOpen: true,
            propertiesPanelOpen: true,
            layersPanelOpen: true,
            chatPanelOpen: false,
          }, false, 'resetUI'),
      }),
      {
        name: 'imagineer-app-store',
        partialize: (state) => ({
          // Only persist UI preferences
          sidebarOpen: state.sidebarOpen,
          propertiesPanelOpen: state.propertiesPanelOpen,
          layersPanelOpen: state.layersPanelOpen,
          chatPanelOpen: state.chatPanelOpen,
          zoom: state.zoom,
          viewportPosition: state.viewportPosition,
        }),
      }
    ),
    {
      name: 'app-store',
    }
  )
)

// Selector hooks for better performance
export const useCurrentProject = () => useAppStore((state) => state.currentProject)
export const useCurrentFile = () => useAppStore((state) => state.currentFile)
export const useCurrentParsedDesign = () => useAppStore((state) => state.currentParsedDesign)
export const useSelectedElements = () => useAppStore((state) => state.selectedElements)
export const useIsCollaborating = () => useAppStore((state) => state.isCollaborating)
export const useOnlineUsers = () => useAppStore((state) => state.onlineUsers)
export const useUIState = () => useAppStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  propertiesPanelOpen: state.propertiesPanelOpen,
  layersPanelOpen: state.layersPanelOpen,
  chatPanelOpen: state.chatPanelOpen,
}))
export const useEditorState = () => useAppStore((state) => ({
  selectedElements: state.selectedElements,
  zoom: state.zoom,
  viewportPosition: state.viewportPosition,
  clipboard: state.clipboard,
}))
export const useLoadingState = () => useAppStore((state) => ({
  isLoading: state.isLoading,
  loadingMessage: state.loadingMessage,
}))
export const useErrorState = () => useAppStore((state) => state.error)