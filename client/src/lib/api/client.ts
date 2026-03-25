import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { ApiResponse, ApiError, AuthTokens } from './types';

// API Configuration
const API_CONFIG = {
  API_GATEWAY_URL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8090',
  DESIGN_PARSER_URL: import.meta.env.VITE_DESIGN_PARSER_URL || 'http://localhost:8001',
  TRANSLATION_ENGINE_URL: import.meta.env.VITE_TRANSLATION_ENGINE_URL || 'http://localhost:8002',
  EXPORT_ENGINE_URL: import.meta.env.VITE_EXPORT_ENGINE_URL || 'http://localhost:8003',
  COLLABORATION_HUB_URL: import.meta.env.VITE_COLLABORATION_HUB_URL || 'http://localhost:8004',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8004',
};

export class ApiClient {
  private readonly client: AxiosInstance;
  private authTokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(baseURL: string = API_CONFIG.API_GATEWAY_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadTokensFromStorage();
  }

  private setupInterceptors(): void {
    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        if (this.authTokens?.access_token) {
          config.headers.Authorization = `Bearer ${this.authTokens.access_token}`;
        }

        // Add organization context if available
        const orgId = this.getCurrentOrganizationId();
        if (orgId) {
          config.headers['X-Organization-ID'] = orgId;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newTokens = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.logout();
            throw refreshError;
          }
        }

        // Handle other errors
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleApiError(error: any): void {
    if (error.response?.data?.error) {
      const apiError: ApiError = error.response.data.error;
      
      // Show user-friendly error messages
      if (apiError.code === 'VALIDATION_ERROR') {
        const validationErrors = apiError.validation_errors || [];
        validationErrors.forEach((valError) => {
          toast.error(`${valError.field}: ${valError.message}`);
        });
      } else if (apiError.code === 'RATE_LIMIT_EXCEEDED') {
        toast.error('Too many requests. Please try again later.');
      } else {
        toast.error(apiError.message || 'An unexpected error occurred');
      }
    } else if (error.code === 'NETWORK_ERROR') {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An unexpected error occurred');
    }
  }

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  public setAuthTokens(tokens: AuthTokens): void {
    this.authTokens = tokens;
    this.saveTokensToStorage(tokens);
  }

  public getAuthTokens(): AuthTokens | null {
    return this.authTokens;
  }

  public isAuthenticated(): boolean {
    return this.authTokens !== null && this.authTokens.expires_at > Date.now();
  }

  public logout(): void {
    this.authTokens = null;
    this.removeTokensFromStorage();
    window.location.href = '/login';
  }

  private async refreshAccessToken(): Promise<AuthTokens> {
    if (!this.authTokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    // Prevent multiple refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.client.post<ApiResponse<AuthTokens>>('/auth/refresh', {
      refresh_token: this.authTokens.refresh_token,
    }).then((response) => {
      const newTokens = response.data.data;
      this.setAuthTokens(newTokens);
      this.refreshPromise = null;
      return newTokens;
    }).catch((error) => {
      this.refreshPromise = null;
      throw error;
    });

    return this.refreshPromise;
  }

  private saveTokensToStorage(tokens: AuthTokens): void {
    try {
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.warn('Failed to save tokens to localStorage:', error);
    }
  }

  private loadTokensFromStorage(): void {
    try {
      const stored = localStorage.getItem('auth_tokens');
      if (stored) {
        const tokens: AuthTokens = JSON.parse(stored);
        if (tokens.expires_at > Date.now()) {
          this.authTokens = tokens;
        } else {
          this.removeTokensFromStorage();
        }
      }
    } catch (error) {
      console.warn('Failed to load tokens from localStorage:', error);
      this.removeTokensFromStorage();
    }
  }

  private removeTokensFromStorage(): void {
    try {
      localStorage.removeItem('auth_tokens');
    } catch (error) {
      console.warn('Failed to remove tokens from localStorage:', error);
    }
  }

  private getCurrentOrganizationId(): string | null {
    try {
      return localStorage.getItem('current_organization_id');
    } catch {
      return null;
    }
  }

  // ============================================================================
  // HTTP METHODS
  // ============================================================================

  public async get<T = any>(
    url: string, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.get(url, config);
    return response.data;
  }

  public async post<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, config);
    return response.data;
  }

  public async put<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data, config);
    return response.data;
  }

  public async patch<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.patch(url, data, config);
    return response.data;
  }

  public async delete<T = any>(
    url: string, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(url, config);
    return response.data;
  }

  // ============================================================================
  // FILE UPLOAD METHODS
  // ============================================================================

  public async uploadFile<T = any>(
    url: string,
    file: File,
    data?: Record<string, any>,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress ? (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        onProgress(progress);
      } : undefined,
    };

    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, formData, config);
    return response.data;
  }

  // ============================================================================
  // DOWNLOAD METHODS
  // ============================================================================

  public async downloadFile(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================

  public createWebSocketConnection(path: string = ''): WebSocket {
    const wsUrl = `${API_CONFIG.WS_URL}${path}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send auth token if available
      if (this.authTokens?.access_token) {
        ws.send(JSON.stringify({
          type: 'auth',
          token: this.authTokens.access_token,
        }));
      }
    };

    return ws;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  public buildQueryParams(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    return searchParams.toString();
  }

  public getServiceUrl(service: 'design-parser' | 'translation-engine' | 'export-engine' | 'collaboration-hub'): string {
    switch (service) {
      case 'design-parser':
        return API_CONFIG.DESIGN_PARSER_URL;
      case 'translation-engine':
        return API_CONFIG.TRANSLATION_ENGINE_URL;
      case 'export-engine':
        return API_CONFIG.EXPORT_ENGINE_URL;
      case 'collaboration-hub':
        return API_CONFIG.COLLABORATION_HUB_URL;
      default:
        return API_CONFIG.API_GATEWAY_URL;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();