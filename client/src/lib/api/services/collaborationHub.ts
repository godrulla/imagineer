import { apiClient } from '../client';
import {
  CollaborationSession,
  SessionParticipant,
  CollaborationEvent,
  WebSocketMessage,
  CursorUpdateMessage,
  SelectionUpdateMessage,
  ElementUpdateMessage,
  CommentMessage,
  Position,
  PaginatedResponse,
} from '../types';

export class CollaborationHubService {
  private readonly basePath = '/v1';
  private wsConnections: Map<string, WebSocket> = new Map();
  private eventCallbacks: Map<string, Function[]> = new Map();

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async createSession(data: {
    project_id: string;
    design_file_id?: string;
    session_type: 'design_editing' | 'review' | 'translation';
  }): Promise<CollaborationSession> {
    const response = await apiClient.post<CollaborationSession>(
      `${this.basePath}/sessions`,
      data
    );
    return response.data;
  }

  async getSessions(params?: {
    page?: number;
    limit?: number;
    project_id?: string;
    session_type?: string;
    is_active?: boolean;
  }): Promise<PaginatedResponse<CollaborationSession>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<CollaborationSession>>(
      `${this.basePath}/sessions${queryString}`
    );
    return response.data;
  }

  async getSession(sessionId: string): Promise<CollaborationSession> {
    const response = await apiClient.get<CollaborationSession>(
      `${this.basePath}/sessions/${sessionId}`
    );
    return response.data;
  }

  async joinSession(sessionId: string): Promise<{
    session: CollaborationSession;
    participant: SessionParticipant;
    websocket_url: string;
  }> {
    const response = await apiClient.post<{
      session: CollaborationSession;
      participant: SessionParticipant;
      websocket_url: string;
    }>(`${this.basePath}/sessions/${sessionId}/join`);
    return response.data;
  }

  async leaveSession(sessionId: string): Promise<void> {
    await apiClient.post(`${this.basePath}/sessions/${sessionId}/leave`);
    this.disconnectWebSocket(sessionId);
  }

  async updateSessionSettings(sessionId: string, settings: {
    permissions?: Record<string, string[]>;
    auto_save?: boolean;
    conflict_resolution?: 'last_writer_wins' | 'manual_resolution';
  }): Promise<CollaborationSession> {
    const response = await apiClient.patch<CollaborationSession>(
      `${this.basePath}/sessions/${sessionId}/settings`,
      settings
    );
    return response.data;
  }

  // ============================================================================
  // PARTICIPANT MANAGEMENT
  // ============================================================================

  async getSessionParticipants(sessionId: string): Promise<SessionParticipant[]> {
    const response = await apiClient.get<SessionParticipant[]>(
      `${this.basePath}/sessions/${sessionId}/participants`
    );
    return response.data;
  }

  async updateParticipantRole(
    sessionId: string,
    userId: string,
    role: 'owner' | 'editor' | 'reviewer' | 'viewer'
  ): Promise<SessionParticipant> {
    const response = await apiClient.patch<SessionParticipant>(
      `${this.basePath}/sessions/${sessionId}/participants/${userId}`,
      { role }
    );
    return response.data;
  }

  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/sessions/${sessionId}/participants/${userId}`);
  }

  // ============================================================================
  // REAL-TIME EVENTS
  // ============================================================================

  async getSessionEvents(
    sessionId: string,
    params?: {
      page?: number;
      limit?: number;
      event_type?: string;
      since?: string;
    }
  ): Promise<PaginatedResponse<CollaborationEvent>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<CollaborationEvent>>(
      `${this.basePath}/sessions/${sessionId}/events${queryString}`
    );
    return response.data;
  }

  // ============================================================================
  // WEBSOCKET MANAGEMENT
  // ============================================================================

  connectWebSocket(sessionId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const ws = apiClient.createWebSocketConnection(`/sessions/${sessionId}`);
        
        ws.onopen = () => {
          this.wsConnections.set(sessionId, ws);
          resolve(ws);
        };

        ws.onmessage = (event) => {
          this.handleWebSocketMessage(sessionId, JSON.parse(event.data));
        };

        ws.onclose = () => {
          this.wsConnections.delete(sessionId);
          this.triggerCallbacks(sessionId, 'disconnect', {});
        };

        ws.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnectWebSocket(sessionId: string): void {
    const ws = this.wsConnections.get(sessionId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(sessionId);
    }
  }

  private handleWebSocketMessage(sessionId: string, message: WebSocketMessage): void {
    this.triggerCallbacks(sessionId, message.type, message);
  }

  // ============================================================================
  // EVENT PUBLISHING
  // ============================================================================

  sendCursorUpdate(sessionId: string, position: Position): void {
    this.sendWebSocketMessage(sessionId, {
      type: 'cursor_update',
      payload: { position },
      timestamp: new Date().toISOString(),
    });
  }

  sendSelectionUpdate(sessionId: string, selectedElements: string[]): void {
    this.sendWebSocketMessage(sessionId, {
      type: 'selection_update',
      payload: { selected_elements: selectedElements },
      timestamp: new Date().toISOString(),
    });
  }

  sendElementUpdate(sessionId: string, elementId: string, changes: Record<string, any>): void {
    this.sendWebSocketMessage(sessionId, {
      type: 'element_update',
      payload: { element_id: elementId, changes },
      timestamp: new Date().toISOString(),
    });
  }

  sendComment(sessionId: string, content: string, position: Position): void {
    this.sendWebSocketMessage(sessionId, {
      type: 'comment_add',
      payload: { content, position },
      timestamp: new Date().toISOString(),
    });
  }

  private sendWebSocketMessage(sessionId: string, message: WebSocketMessage): void {
    const ws = this.wsConnections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  addEventListener(sessionId: string, eventType: string, callback: Function): void {
    const key = `${sessionId}:${eventType}`;
    if (!this.eventCallbacks.has(key)) {
      this.eventCallbacks.set(key, []);
    }
    this.eventCallbacks.get(key)!.push(callback);
  }

  removeEventListener(sessionId: string, eventType: string, callback: Function): void {
    const key = `${sessionId}:${eventType}`;
    const callbacks = this.eventCallbacks.get(key);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private triggerCallbacks(sessionId: string, eventType: string, data: any): void {
    const key = `${sessionId}:${eventType}`;
    const callbacks = this.eventCallbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in collaboration event callback:', error);
        }
      });
    }
  }

  // ============================================================================
  // CONFLICT RESOLUTION
  // ============================================================================

  async getConflicts(sessionId: string): Promise<Array<{
    id: string;
    element_id: string;
    conflicting_changes: Array<{
      user_id: string;
      user_name: string;
      changes: Record<string, any>;
      timestamp: string;
    }>;
    resolution_strategy: 'manual' | 'auto';
    created_at: string;
  }>> {
    const response = await apiClient.get<Array<{
      id: string;
      element_id: string;
      conflicting_changes: Array<{
        user_id: string;
        user_name: string;
        changes: Record<string, any>;
        timestamp: string;
      }>;
      resolution_strategy: 'manual' | 'auto';
      created_at: string;
    }>>(`${this.basePath}/sessions/${sessionId}/conflicts`);
    return response.data;
  }

  async resolveConflict(
    sessionId: string,
    conflictId: string,
    resolution: {
      accepted_changes: Record<string, any>;
      rejected_change_ids: string[];
    }
  ): Promise<void> {
    await apiClient.post(
      `${this.basePath}/sessions/${sessionId}/conflicts/${conflictId}/resolve`,
      resolution
    );
  }

  // ============================================================================
  // COMMENTS & ANNOTATIONS
  // ============================================================================

  async getComments(
    sessionId: string,
    params?: {
      page?: number;
      limit?: number;
      element_id?: string;
      resolved?: boolean;
    }
  ): Promise<PaginatedResponse<{
    id: string;
    content: string;
    position: Position;
    element_id?: string;
    user_id: string;
    user_name: string;
    resolved: boolean;
    replies: Array<{
      id: string;
      content: string;
      user_id: string;
      user_name: string;
      created_at: string;
    }>;
    created_at: string;
    updated_at: string;
  }>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<{
      id: string;
      content: string;
      position: Position;
      element_id?: string;
      user_id: string;
      user_name: string;
      resolved: boolean;
      replies: Array<{
        id: string;
        content: string;
        user_id: string;
        user_name: string;
        created_at: string;
      }>;
      created_at: string;
      updated_at: string;
    }>>(`${this.basePath}/sessions/${sessionId}/comments${queryString}`);
    return response.data;
  }

  async addComment(sessionId: string, data: {
    content: string;
    position: Position;
    element_id?: string;
  }): Promise<{
    id: string;
    content: string;
    position: Position;
    element_id?: string;
    user_id: string;
    user_name: string;
    resolved: boolean;
    created_at: string;
  }> {
    const response = await apiClient.post<{
      id: string;
      content: string;
      position: Position;
      element_id?: string;
      user_id: string;
      user_name: string;
      resolved: boolean;
      created_at: string;
    }>(`${this.basePath}/sessions/${sessionId}/comments`, data);
    return response.data;
  }

  async resolveComment(sessionId: string, commentId: string): Promise<void> {
    await apiClient.patch(`${this.basePath}/sessions/${sessionId}/comments/${commentId}`, {
      resolved: true,
    });
  }

  // ============================================================================
  // VERSION CONTROL
  // ============================================================================

  async createCheckpoint(sessionId: string, description?: string): Promise<{
    id: string;
    description: string;
    snapshot_data: Record<string, any>;
    created_at: string;
    created_by: string;
  }> {
    const response = await apiClient.post<{
      id: string;
      description: string;
      snapshot_data: Record<string, any>;
      created_at: string;
      created_by: string;
    }>(`${this.basePath}/sessions/${sessionId}/checkpoints`, { description });
    return response.data;
  }

  async getCheckpoints(sessionId: string): Promise<Array<{
    id: string;
    description: string;
    created_at: string;
    created_by: string;
    created_by_name: string;
  }>> {
    const response = await apiClient.get<Array<{
      id: string;
      description: string;
      created_at: string;
      created_by: string;
      created_by_name: string;
    }>>(`${this.basePath}/sessions/${sessionId}/checkpoints`);
    return response.data;
  }

  async restoreCheckpoint(sessionId: string, checkpointId: string): Promise<void> {
    await apiClient.post(`${this.basePath}/sessions/${sessionId}/checkpoints/${checkpointId}/restore`);
  }

  // ============================================================================
  // PRESENCE & AWARENESS
  // ============================================================================

  async updatePresence(sessionId: string, presence: {
    cursor_position?: Position;
    selected_elements?: string[];
    active_tool?: string;
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  }): Promise<void> {
    await apiClient.patch(`${this.basePath}/sessions/${sessionId}/presence`, presence);
  }

  async getPresence(sessionId: string): Promise<Record<string, {
    user_id: string;
    user_name: string;
    avatar_url?: string;
    cursor_position?: Position;
    selected_elements?: string[];
    active_tool?: string;
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
    last_activity: string;
    is_online: boolean;
  }>> {
    const response = await apiClient.get<Record<string, {
      user_id: string;
      user_name: string;
      avatar_url?: string;
      cursor_position?: Position;
      selected_elements?: string[];
      active_tool?: string;
      viewport?: {
        x: number;
        y: number;
        zoom: number;
      };
      last_activity: string;
      is_online: boolean;
    }>>(`${this.basePath}/sessions/${sessionId}/presence`);
    return response.data;
  }

  // ============================================================================
  // HEALTH & STATUS
  // ============================================================================

  async getHealth(): Promise<{ status: string; version: string; timestamp: string; uptime_seconds: number }> {
    const response = await apiClient.get<{ status: string; version: string; timestamp: string; uptime_seconds: number }>(
      `${this.basePath}/health`
    );
    return response.data;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate unique colors for participants
   */
  getParticipantColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#B8860B', '#DDA0DD', '#20B2AA',
      '#F0E68C', '#FF69B4', '#87CEEB', '#DEB887',
    ];
    
    const hash = userId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return colors[hash % colors.length];
  }

  /**
   * Check if user has permission for action
   */
  hasPermission(participant: SessionParticipant, action: string): boolean {
    const rolePermissions = {
      owner: ['read', 'write', 'admin', 'delete'],
      editor: ['read', 'write'],
      reviewer: ['read', 'comment'],
      viewer: ['read'],
    };
    
    const permissions = rolePermissions[participant.role] || [];
    return permissions.includes(action);
  }

  /**
   * Format last activity time
   */
  formatLastActivity(timestamp: string): string {
    const now = new Date();
    const lastActivity = new Date(timestamp);
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  }

  /**
   * Clean up resources for session
   */
  cleanup(sessionId: string): void {
    this.disconnectWebSocket(sessionId);
    
    // Remove all event listeners for this session
    const keysToRemove: string[] = [];
    this.eventCallbacks.forEach((_, key) => {
      if (key.startsWith(`${sessionId}:`)) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      this.eventCallbacks.delete(key);
    });
  }
}

export const collaborationHubService = new CollaborationHubService();