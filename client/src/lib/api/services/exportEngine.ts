import { apiClient } from '../client';
import {
  ExportRequest,
  ExportResult,
  ExportFile,
  ExportFormat,
  Job,
  JobDetail,
  PaginatedResponse,
  ApiResponse,
} from '../types';

export class ExportEngineService {
  private readonly basePath = '/v1';

  // ============================================================================
  // EXPORT MANAGEMENT
  // ============================================================================

  async createExport(data: ExportRequest): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/exports`,
      data
    );
    return response.data;
  }

  async getExports(params?: {
    page?: number;
    limit?: number;
    source_type?: string;
    export_format?: string;
    status?: string;
  }): Promise<PaginatedResponse<ExportResult>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<ExportResult>>(
      `${this.basePath}/exports${queryString}`
    );
    return response.data;
  }

  async getExport(exportId: string): Promise<ExportResult> {
    const response = await apiClient.get<ExportResult>(
      `${this.basePath}/exports/${exportId}`
    );
    return response.data;
  }

  async deleteExport(exportId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/exports/${exportId}`);
  }

  async retryExport(exportId: string): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/exports/${exportId}/retry`
    );
    return response.data;
  }

  // ============================================================================
  // BATCH EXPORTS
  // ============================================================================

  async createBatchExport(data: {
    source_ids: string[];
    source_type: 'design_file' | 'translation_result';
    export_format: ExportFormat;
    template_id?: string;
    customizations?: Record<string, any>;
    output_options?: {
      include_assets: boolean;
      asset_optimization: 'none' | 'basic' | 'aggressive';
      bundle_type: 'single_file' | 'multi_file' | 'archive';
    };
  }): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/exports/batch`,
      data
    );
    return response.data;
  }

  async getBatchExportStatus(batchId: string): Promise<{
    batch_id: string;
    total_items: number;
    completed_items: number;
    failed_items: number;
    progress_percentage: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    individual_exports: Array<{
      export_id: string;
      source_id: string;
      status: string;
      error_message?: string;
    }>;
  }> {
    const response = await apiClient.get<{
      batch_id: string;
      total_items: number;
      completed_items: number;
      failed_items: number;
      progress_percentage: number;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      individual_exports: Array<{
        export_id: string;
        source_id: string;
        status: string;
        error_message?: string;
      }>;
    }>(`${this.basePath}/exports/batch/${batchId}/status`);
    return response.data;
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  async getTemplates(params?: {
    page?: number;
    limit?: number;
    category?: string;
    export_format?: string;
    search?: string;
  }): Promise<PaginatedResponse<{
    id: string;
    name: string;
    description: string;
    category: string;
    export_format: ExportFormat;
    template_content: string;
    variables: Record<string, any>;
    preview_url?: string;
    usage_count: number;
    created_at: string;
    updated_at: string;
  }>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<{
      id: string;
      name: string;
      description: string;
      category: string;
      export_format: ExportFormat;
      template_content: string;
      variables: Record<string, any>;
      preview_url?: string;
      usage_count: number;
      created_at: string;
      updated_at: string;
    }>>(`${this.basePath}/templates${queryString}`);
    return response.data;
  }

  async getTemplate(templateId: string): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    export_format: ExportFormat;
    template_content: string;
    variables: Record<string, any>;
    sample_output?: string;
    documentation?: string;
    created_at: string;
    updated_at: string;
  }> {
    const response = await apiClient.get<{
      id: string;
      name: string;
      description: string;
      category: string;
      export_format: ExportFormat;
      template_content: string;
      variables: Record<string, any>;
      sample_output?: string;
      documentation?: string;
      created_at: string;
      updated_at: string;
    }>(`${this.basePath}/templates/${templateId}`);
    return response.data;
  }

  async createTemplate(data: {
    name: string;
    description: string;
    category: string;
    export_format: ExportFormat;
    template_content: string;
    variables?: Record<string, any>;
  }): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    export_format: ExportFormat;
    template_content: string;
    variables: Record<string, any>;
    created_at: string;
    updated_at: string;
  }> {
    const response = await apiClient.post<{
      id: string;
      name: string;
      description: string;
      category: string;
      export_format: ExportFormat;
      template_content: string;
      variables: Record<string, any>;
      created_at: string;
      updated_at: string;
    }>(`${this.basePath}/templates`, data);
    return response.data;
  }

  // ============================================================================
  // PREVIEW & VALIDATION
  // ============================================================================

  async previewExport(data: {
    source_type: 'design_file' | 'translation_result';
    source_id: string;
    export_format: ExportFormat;
    template_id?: string;
    customizations?: Record<string, any>;
  }): Promise<{
    preview_content: string;
    file_structure: Array<{
      filename: string;
      file_type: string;
      size_estimate: number;
    }>;
    estimated_generation_time: number;
  }> {
    const response = await apiClient.post<{
      preview_content: string;
      file_structure: Array<{
        filename: string;
        file_type: string;
        size_estimate: number;
      }>;
      estimated_generation_time: number;
    }>(`${this.basePath}/exports/preview`, data);
    return response.data;
  }

  async validateTemplate(templateContent: string, exportFormat: ExportFormat): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    variables_detected: string[];
    sample_output?: string;
  }> {
    const response = await apiClient.post<{
      valid: boolean;
      errors: string[];
      warnings: string[];
      variables_detected: string[];
      sample_output?: string;
    }>(`${this.basePath}/templates/validate`, {
      template_content: templateContent,
      export_format: exportFormat,
    });
    return response.data;
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  async downloadExport(exportId: string, filename?: string): Promise<void> {
    await apiClient.downloadFile(`${this.basePath}/exports/${exportId}/download`, filename);
  }

  async downloadExportFile(exportId: string, fileId: string, filename?: string): Promise<void> {
    await apiClient.downloadFile(
      `${this.basePath}/exports/${exportId}/files/${fileId}/download`,
      filename
    );
  }

  async getExportFiles(exportId: string): Promise<ExportFile[]> {
    const response = await apiClient.get<ExportFile[]>(
      `${this.basePath}/exports/${exportId}/files`
    );
    return response.data;
  }

  // ============================================================================
  // ANALYTICS & MONITORING
  // ============================================================================

  async getExportAnalytics(params?: {
    start_date?: string;
    end_date?: string;
    group_by?: 'day' | 'week' | 'month';
  }): Promise<{
    total_exports: number;
    successful_exports: number;
    failed_exports: number;
    popular_formats: Array<{
      format: ExportFormat;
      count: number;
      success_rate: number;
    }>;
    popular_templates: Array<{
      template_id: string;
      template_name: string;
      usage_count: number;
    }>;
    average_generation_time: number;
    timeline: Array<{
      date: string;
      exports: number;
      success_rate: number;
      average_generation_time: number;
    }>;
  }> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<{
      total_exports: number;
      successful_exports: number;
      failed_exports: number;
      popular_formats: Array<{
        format: ExportFormat;
        count: number;
        success_rate: number;
      }>;
      popular_templates: Array<{
        template_id: string;
        template_name: string;
        usage_count: number;
      }>;
      average_generation_time: number;
      timeline: Array<{
        date: string;
        exports: number;
        success_rate: number;
        average_generation_time: number;
      }>;
    }>(`${this.basePath}/analytics/exports${queryString}`);
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
   * Get supported export formats with descriptions
   */
  getSupportedFormats(): Array<{
    id: ExportFormat;
    name: string;
    description: string;
    extensions: string[];
    category: string;
  }> {
    return [
      {
        id: 'html_css',
        name: 'HTML + CSS',
        description: 'Static HTML with CSS styles',
        extensions: ['.html', '.css'],
        category: 'Web',
      },
      {
        id: 'react_typescript',
        name: 'React TypeScript',
        description: 'React components with TypeScript',
        extensions: ['.tsx', '.ts'],
        category: 'React',
      },
      {
        id: 'vue_typescript',
        name: 'Vue TypeScript',
        description: 'Vue components with TypeScript',
        extensions: ['.vue', '.ts'],
        category: 'Vue',
      },
      {
        id: 'angular_typescript',
        name: 'Angular TypeScript',
        description: 'Angular components with TypeScript',
        extensions: ['.component.ts', '.component.html'],
        category: 'Angular',
      },
      {
        id: 'flutter_dart',
        name: 'Flutter Dart',
        description: 'Flutter widgets in Dart',
        extensions: ['.dart'],
        category: 'Mobile',
      },
      {
        id: 'react_native',
        name: 'React Native',
        description: 'React Native components',
        extensions: ['.tsx', '.ts'],
        category: 'Mobile',
      },
      {
        id: 'markdown',
        name: 'Markdown Documentation',
        description: 'Clean markdown documentation',
        extensions: ['.md'],
        category: 'Documentation',
      },
      {
        id: 'json_schema',
        name: 'JSON Schema',
        description: 'Structured JSON schema',
        extensions: ['.json'],
        category: 'Data',
      },
      {
        id: 'yaml_config',
        name: 'YAML Configuration',
        description: 'YAML configuration files',
        extensions: ['.yaml', '.yml'],
        category: 'Data',
      },
      {
        id: 'figma_plugin',
        name: 'Figma Plugin',
        description: 'Figma plugin code',
        extensions: ['.js', '.ts'],
        category: 'Figma',
      },
    ];
  }

  /**
   * Get export status color for UI
   */
  getExportStatusColor(status: string): string {
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
   * Get format icon for UI
   */
  getFormatIcon(format: ExportFormat): string {
    const iconMap: Record<ExportFormat, string> = {
      'html_css': '🌐',
      'react_typescript': '⚛️',
      'vue_typescript': '💚',
      'angular_typescript': '🅰️',
      'flutter_dart': '📱',
      'react_native': '📱',
      'markdown': '📝',
      'json_schema': '📋',
      'yaml_config': '⚙️',
      'figma_plugin': '🎨',
    };
    
    return iconMap[format] || '📄';
  }

  /**
   * Estimate generation time based on complexity
   */
  estimateGenerationTime(
    sourceType: string,
    format: ExportFormat,
    fileCount: number = 1
  ): number {
    // Base time in seconds
    const baseTimes: Record<ExportFormat, number> = {
      'html_css': 5,
      'react_typescript': 15,
      'vue_typescript': 15,
      'angular_typescript': 20,
      'flutter_dart': 25,
      'react_native': 20,
      'markdown': 3,
      'json_schema': 2,
      'yaml_config': 2,
      'figma_plugin': 30,
    };

    const baseTime = baseTimes[format] || 10;
    const complexityMultiplier = sourceType === 'translation_result' ? 0.5 : 1;
    const fileMultiplier = Math.log(fileCount + 1);

    return Math.round(baseTime * complexityMultiplier * fileMultiplier);
  }
}

export const exportEngineService = new ExportEngineService();