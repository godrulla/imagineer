import { apiClient } from '../client';
import {
  AuthUser,
  AuthTokens,
  Organization,
  LoginRequest,
  RegisterRequest,
  ApiResponse,
} from '../types';

export class AuthService {
  private readonly basePath = '/auth';

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  async login(credentials: LoginRequest): Promise<{
    user: AuthUser;
    tokens: AuthTokens;
  }> {
    const response = await apiClient.post<{
      user: AuthUser;
      tokens: AuthTokens;
    }>(`${this.basePath}/login`, credentials);
    
    // Store tokens automatically
    apiClient.setAuthTokens(response.data.tokens);
    
    return response.data;
  }

  async register(data: RegisterRequest): Promise<{
    user: AuthUser;
    tokens: AuthTokens;
  }> {
    const response = await apiClient.post<{
      user: AuthUser;
      tokens: AuthTokens;
    }>(`${this.basePath}/register`, data);
    
    // Store tokens automatically
    apiClient.setAuthTokens(response.data.tokens);
    
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post(`${this.basePath}/logout`);
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      apiClient.logout();
    }
  }

  async refreshToken(): Promise<AuthTokens> {
    const tokens = apiClient.getAuthTokens();
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post<AuthTokens>(`${this.basePath}/refresh`, {
      refresh_token: tokens.refresh_token,
    });

    apiClient.setAuthTokens(response.data);
    return response.data;
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`${this.basePath}/forgot-password`, {
      email,
    });
    return response.data;
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`${this.basePath}/reset-password`, {
      token,
      password,
    });
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`${this.basePath}/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  async getCurrentUser(): Promise<AuthUser> {
    const response = await apiClient.get<AuthUser>(`${this.basePath}/me`);
    return response.data;
  }

  async updateProfile(data: {
    name?: string;
    email?: string;
    avatar_url?: string;
    preferences?: Record<string, any>;
  }): Promise<AuthUser> {
    const response = await apiClient.patch<AuthUser>(`${this.basePath}/me`, data);
    return response.data;
  }

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const response = await apiClient.uploadFile<{ avatar_url: string }>(
      `${this.basePath}/me/avatar`,
      file
    );
    return response.data;
  }

  async deleteAccount(): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`${this.basePath}/me`);
    return response.data;
  }

  // ============================================================================
  // ORGANIZATION MANAGEMENT
  // ============================================================================

  async getOrganizations(): Promise<Organization[]> {
    const response = await apiClient.get<Organization[]>(`${this.basePath}/organizations`);
    return response.data;
  }

  async createOrganization(data: {
    name: string;
    slug?: string;
    plan?: 'free' | 'pro' | 'enterprise';
  }): Promise<Organization> {
    const response = await apiClient.post<Organization>(`${this.basePath}/organizations`, data);
    return response.data;
  }

  async switchOrganization(organizationId: string): Promise<AuthUser> {
    const response = await apiClient.post<AuthUser>(`${this.basePath}/switch-organization`, {
      organization_id: organizationId,
    });
    
    // Store the current organization ID
    try {
      localStorage.setItem('current_organization_id', organizationId);
    } catch (error) {
      console.warn('Failed to store current organization ID:', error);
    }
    
    return response.data;
  }

  async getOrganizationMembers(organizationId: string): Promise<Array<{
    user_id: string;
    user_name: string;
    user_email: string;
    user_avatar_url?: string;
    role: 'owner' | 'admin' | 'member';
    permissions: string[];
    joined_at: string;
    last_activity: string;
  }>> {
    const response = await apiClient.get<Array<{
      user_id: string;
      user_name: string;
      user_email: string;
      user_avatar_url?: string;
      role: 'owner' | 'admin' | 'member';
      permissions: string[];
      joined_at: string;
      last_activity: string;
    }>>(`${this.basePath}/organizations/${organizationId}/members`);
    return response.data;
  }

  async inviteToOrganization(organizationId: string, data: {
    email: string;
    role: 'admin' | 'member';
    permissions?: string[];
  }): Promise<{ message: string; invitation_id: string }> {
    const response = await apiClient.post<{ message: string; invitation_id: string }>(
      `${this.basePath}/organizations/${organizationId}/invite`,
      data
    );
    return response.data;
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    data: {
      role: 'admin' | 'member';
      permissions?: string[];
    }
  ): Promise<{ message: string }> {
    const response = await apiClient.patch<{ message: string }>(
      `${this.basePath}/organizations/${organizationId}/members/${userId}`,
      data
    );
    return response.data;
  }

  async removeMember(organizationId: string, userId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(
      `${this.basePath}/organizations/${organizationId}/members/${userId}`
    );
    return response.data;
  }

  async leaveOrganization(organizationId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `${this.basePath}/organizations/${organizationId}/leave`
    );
    return response.data;
  }

  // ============================================================================
  // INVITATIONS & TEAM MANAGEMENT
  // ============================================================================

  async getInvitations(): Promise<Array<{
    id: string;
    organization_id: string;
    organization_name: string;
    invited_by_name: string;
    role: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    expires_at: string;
    created_at: string;
  }>> {
    const response = await apiClient.get<Array<{
      id: string;
      organization_id: string;
      organization_name: string;
      invited_by_name: string;
      role: string;
      status: 'pending' | 'accepted' | 'declined' | 'expired';
      expires_at: string;
      created_at: string;
    }>>(`${this.basePath}/invitations`);
    return response.data;
  }

  async acceptInvitation(invitationId: string): Promise<{
    organization: Organization;
    message: string;
  }> {
    const response = await apiClient.post<{
      organization: Organization;
      message: string;
    }>(`${this.basePath}/invitations/${invitationId}/accept`);
    return response.data;
  }

  async declineInvitation(invitationId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `${this.basePath}/invitations/${invitationId}/decline`
    );
    return response.data;
  }

  // ============================================================================
  // API KEYS & INTEGRATIONS
  // ============================================================================

  async getApiKeys(): Promise<Array<{
    id: string;
    name: string;
    prefix: string;
    permissions: string[];
    last_used_at?: string;
    expires_at?: string;
    created_at: string;
  }>> {
    const response = await apiClient.get<Array<{
      id: string;
      name: string;
      prefix: string;
      permissions: string[];
      last_used_at?: string;
      expires_at?: string;
      created_at: string;
    }>>(`${this.basePath}/api-keys`);
    return response.data;
  }

  async createApiKey(data: {
    name: string;
    permissions: string[];
    expires_at?: string;
  }): Promise<{
    id: string;
    name: string;
    key: string;
    permissions: string[];
    expires_at?: string;
    created_at: string;
  }> {
    const response = await apiClient.post<{
      id: string;
      name: string;
      key: string;
      permissions: string[];
      expires_at?: string;
      created_at: string;
    }>(`${this.basePath}/api-keys`, data);
    return response.data;
  }

  async revokeApiKey(keyId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(
      `${this.basePath}/api-keys/${keyId}`
    );
    return response.data;
  }

  async getIntegrations(): Promise<Array<{
    id: string;
    type: 'figma' | 'slack' | 'github' | 'custom';
    name: string;
    status: 'connected' | 'disconnected' | 'error';
    last_sync: string;
    settings: Record<string, any>;
  }>> {
    const response = await apiClient.get<Array<{
      id: string;
      type: 'figma' | 'slack' | 'github' | 'custom';
      name: string;
      status: 'connected' | 'disconnected' | 'error';
      last_sync: string;
      settings: Record<string, any>;
    }>>(`${this.basePath}/integrations`);
    return response.data;
  }

  async connectIntegration(type: string, credentials: Record<string, any>): Promise<{
    id: string;
    type: string;
    status: string;
    message: string;
  }> {
    const response = await apiClient.post<{
      id: string;
      type: string;
      status: string;
      message: string;
    }>(`${this.basePath}/integrations/${type}/connect`, credentials);
    return response.data;
  }

  async disconnectIntegration(integrationId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(
      `${this.basePath}/integrations/${integrationId}`
    );
    return response.data;
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async getSessions(): Promise<Array<{
    id: string;
    device_info: string;
    ip_address: string;
    location?: string;
    is_current: boolean;
    last_activity: string;
    created_at: string;
  }>> {
    const response = await apiClient.get<Array<{
      id: string;
      device_info: string;
      ip_address: string;
      location?: string;
      is_current: boolean;
      last_activity: string;
      created_at: string;
    }>>(`${this.basePath}/sessions`);
    return response.data;
  }

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(
      `${this.basePath}/sessions/${sessionId}`
    );
    return response.data;
  }

  async revokeAllSessions(): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`${this.basePath}/sessions`);
    return response.data;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return apiClient.isAuthenticated();
  }

  /**
   * Get current auth tokens
   */
  getTokens(): AuthTokens | null {
    return apiClient.getAuthTokens();
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): {
    valid: boolean;
    errors: string[];
    score: number;
  } {
    const errors: string[] = [];
    let score = 0;

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    return {
      valid: errors.length === 0,
      errors,
      score,
    };
  }

  /**
   * Get password strength color
   */
  getPasswordStrengthColor(score: number): string {
    if (score >= 4) return 'green';
    if (score >= 3) return 'yellow';
    if (score >= 2) return 'orange';
    return 'red';
  }

  /**
   * Get password strength label
   */
  getPasswordStrengthLabel(score: number): string {
    if (score >= 4) return 'Strong';
    if (score >= 3) return 'Good';
    if (score >= 2) return 'Fair';
    return 'Weak';
  }

  /**
   * Format user role for display
   */
  formatUserRole(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  /**
   * Get user initials for avatar fallback
   */
  getUserInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}

export const authService = new AuthService();