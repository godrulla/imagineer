import { apiClient } from '../client';
import {
  Project,
  ProjectDetail,
  DesignFile,
  DesignFileDetail,
  ParsedDesign,
  DesignElement,
  CreateProjectRequest,
  UpdateProjectRequest,
  ImportFigmaRequest,
  ProcessFileRequest,
  Job,
  JobDetail,
  PaginatedResponse,
  ApiResponse,
} from '../types';

export class DesignParserService {
  private readonly basePath = '/v1';

  // ============================================================================
  // PROJECT MANAGEMENT
  // ============================================================================

  async getProjects(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    team_id?: string;
    source_tool?: string;
    status?: string;
    search?: string;
  }): Promise<PaginatedResponse<Project>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<Project>>(
      `${this.basePath}/projects${queryString}`
    );
    return response.data;
  }

  async getProject(projectId: string): Promise<ProjectDetail> {
    const response = await apiClient.get<ProjectDetail>(
      `${this.basePath}/projects/${projectId}`
    );
    return response.data;
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    const response = await apiClient.post<Project>(
      `${this.basePath}/projects`,
      data
    );
    return response.data;
  }

  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    const response = await apiClient.put<Project>(
      `${this.basePath}/projects/${projectId}`,
      data
    );
    return response.data;
  }

  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/projects/${projectId}`);
  }

  async syncProject(projectId: string, force = false): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/projects/${projectId}/sync`,
      { force }
    );
    return response.data;
  }

  // ============================================================================
  // DESIGN FILE MANAGEMENT
  // ============================================================================

  async getDesignFiles(
    projectId: string,
    params?: {
      page?: number;
      limit?: number;
      file_type?: string;
      processing_status?: string;
    }
  ): Promise<PaginatedResponse<DesignFile>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<DesignFile>>(
      `${this.basePath}/projects/${projectId}/files${queryString}`
    );
    return response.data;
  }

  async getDesignFile(projectId: string, fileId: string): Promise<DesignFileDetail> {
    const response = await apiClient.get<DesignFileDetail>(
      `${this.basePath}/projects/${projectId}/files/${fileId}`
    );
    return response.data;
  }

  async uploadDesignFile(
    projectId: string,
    file: File,
    options?: {
      name?: string;
      metadata?: Record<string, any>;
      auto_process?: boolean;
    },
    onProgress?: (progress: number) => void
  ): Promise<DesignFile> {
    const response = await apiClient.uploadFile<DesignFile>(
      `${this.basePath}/projects/${projectId}/files`,
      file,
      options,
      onProgress
    );
    return response.data;
  }

  async deleteDesignFile(projectId: string, fileId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/projects/${projectId}/files/${fileId}`);
  }

  async processDesignFile(
    projectId: string,
    fileId: string,
    options?: ProcessFileRequest
  ): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/projects/${projectId}/files/${fileId}/process`,
      options
    );
    return response.data;
  }

  // ============================================================================
  // PARSED DESIGN DATA
  // ============================================================================

  async getParsedDesign(projectId: string, fileId: string): Promise<ParsedDesign> {
    const response = await apiClient.get<ParsedDesign>(
      `${this.basePath}/projects/${projectId}/files/${fileId}/parsed`
    );
    return response.data;
  }

  async getDesignElements(
    projectId: string,
    fileId: string,
    params?: {
      element_type?: string;
      layer_name?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<DesignElement>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<DesignElement>>(
      `${this.basePath}/projects/${projectId}/files/${fileId}/elements${queryString}`
    );
    return response.data;
  }

  // ============================================================================
  // FIGMA INTEGRATION
  // ============================================================================

  async importFromFigma(data: ImportFigmaRequest): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/figma/files`,
      data
    );
    return response.data;
  }

  // ============================================================================
  // JOB MANAGEMENT
  // ============================================================================

  async getJobs(params?: {
    page?: number;
    limit?: number;
    job_type?: string;
    status?: string;
  }): Promise<PaginatedResponse<Job>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<Job>>(
      `${this.basePath}/jobs${queryString}`
    );
    return response.data;
  }

  async getJob(jobId: string): Promise<JobDetail> {
    const response = await apiClient.get<JobDetail>(
      `${this.basePath}/jobs/${jobId}`
    );
    return response.data;
  }

  async cancelJob(jobId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/jobs/${jobId}`);
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

  async getStatus(): Promise<{
    status: string;
    version: string;
    timestamp: string;
    dependencies: Record<string, any>;
    metrics: Record<string, any>;
  }> {
    const response = await apiClient.get<{
      status: string;
      version: string;
      timestamp: string;
      dependencies: Record<string, any>;
      metrics: Record<string, any>;
    }>(`${this.basePath}/status`);
    return response.data;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extract Figma file key from URL
   */
  extractFigmaFileKey(url: string): string | null {
    const match = url.match(/figma\.com\/file\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * Validate Figma URL format
   */
  isValidFigmaUrl(url: string): boolean {
    return /^https:\/\/www\.figma\.com\/file\/[a-zA-Z0-9]+/.test(url);
  }

  /**
   * Get supported file extensions for upload
   */
  getSupportedFileExtensions(): string[] {
    return ['.fig', '.sketch', '.xd', '.psd', '.ai', '.svg', '.png', '.jpg', '.jpeg'];
  }

  /**
   * Validate file for upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const supportedExtensions = this.getSupportedFileExtensions();
    
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    
    if (!supportedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Unsupported file type. Supported formats: ${supportedExtensions.join(', ')}`,
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size exceeds 100MB limit',
      };
    }

    return { valid: true };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get processing status color for UI
   */
  getProcessingStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'green';
      case 'processing':
        return 'blue';
      case 'failed':
        return 'red';
      case 'pending':
        return 'yellow';
      default:
        return 'gray';
    }
  }
}

export const designParserService = new DesignParserService();