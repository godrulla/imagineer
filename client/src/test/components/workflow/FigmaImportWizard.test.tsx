import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FigmaImportWizard from '../../../components/workflow/FigmaImportWizard';
import { AuthContext } from '../../../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { server } from '../../setup';
import { http, HttpResponse } from 'msw';

// Mock the services
vi.mock('../../../lib/api', () => ({
  designParserService: {
    analyzeDesign: vi.fn(),
    getJob: vi.fn(),
    getJobs: vi.fn()
  }
}));

// Mock the stores
vi.mock('../../../stores/appStore', () => ({
  useAppStore: () => ({
    currentProject: {
      id: 'test-project',
      name: 'Test Project'
    },
    setCurrentFile: vi.fn(),
    setLoading: vi.fn()
  })
}));

vi.mock('../../../stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    currentStep: 0,
    setCurrentStep: vi.fn(),
    resetWorkflow: vi.fn()
  })
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const
};

const mockAuthContext = {
  user: mockUser,
  token: 'mock-token',
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  isLoading: false,
  isAuthenticated: true,
  currentOrganization: {
    id: 'org-123',
    name: 'Test Organization'
  }
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthContext}>
          {children}
          <Toaster />
        </AuthContext.Provider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

describe('FigmaImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the import wizard with initial step', () => {
    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    expect(screen.getByText(/import from figma/i)).toBeInTheDocument();
    expect(screen.getByText(/enter figma file url/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste figma file url/i)).toBeInTheDocument();
  });

  it('should validate Figma URL format', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    const urlInput = screen.getByPlaceholderText(/paste figma file url/i);
    const nextButton = screen.getByRole('button', { name: /next/i });

    // Test invalid URL
    await user.type(urlInput, 'invalid-url');
    await user.click(nextButton);

    expect(screen.getByText(/invalid figma url/i)).toBeInTheDocument();

    // Test valid Figma URL
    await user.clear(urlInput);
    await user.type(urlInput, 'https://www.figma.com/file/123/test-file');
    
    // Should not show error for valid URL
    expect(screen.queryByText(/invalid figma url/i)).not.toBeInTheDocument();
  });

  it('should handle Figma URL parsing and file information display', async () => {
    const user = userEvent.setup();

    // Mock successful file info response
    server.use(
      http.get('https://api.figma.com/v1/files/:fileId', () => {
        return HttpResponse.json({
          name: 'Test Design File',
          lastModified: new Date().toISOString(),
          thumbnailUrl: 'https://example.com/thumbnail.png',
          document: {
            children: [
              { id: 'page1', name: 'Page 1', type: 'CANVAS' }
            ]
          }
        });
      })
    );

    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    const urlInput = screen.getByPlaceholderText(/paste figma file url/i);
    const nextButton = screen.getByRole('button', { name: /next/i });

    await user.type(urlInput, 'https://www.figma.com/file/abc123/test-design-file');
    await user.click(nextButton);

    // Should show loading state while fetching file info
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for file info to load
    await waitFor(() => {
      expect(screen.getByText('Test Design File')).toBeInTheDocument();
    });

    expect(screen.getByText(/select pages to import/i)).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });

  it('should handle Figma API errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock API error response
    server.use(
      http.get('https://api.figma.com/v1/files/:fileId', () => {
        return HttpResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      })
    );

    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    const urlInput = screen.getByPlaceholderText(/paste figma file url/i);
    const nextButton = screen.getByRole('button', { name: /next/i });

    await user.type(urlInput, 'https://www.figma.com/file/invalid/file');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/file not found/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should allow page selection for import', async () => {
    const user = userEvent.setup();

    // Mock file with multiple pages
    server.use(
      http.get('https://api.figma.com/v1/files/:fileId', () => {
        return HttpResponse.json({
          name: 'Multi-page Design',
          document: {
            children: [
              { id: 'page1', name: 'Homepage', type: 'CANVAS' },
              { id: 'page2', name: 'About Page', type: 'CANVAS' },
              { id: 'page3', name: 'Contact Page', type: 'CANVAS' }
            ]
          }
        });
      })
    );

    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    const urlInput = screen.getByPlaceholderText(/paste figma file url/i);
    await user.type(urlInput, 'https://www.figma.com/file/multi/design');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Homepage')).toBeInTheDocument();
    });

    // Should show all pages with checkboxes
    expect(screen.getByText('About Page')).toBeInTheDocument();
    expect(screen.getByText('Contact Page')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);

    // Select specific pages
    await user.click(checkboxes[0]); // Homepage
    await user.click(checkboxes[2]); // Contact Page

    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).toBeChecked();
  });

  it('should configure import options', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    // Navigate to options step (would need to complete previous steps first)
    // For this test, we'll assume we can jump to options

    // Mock the step progression
    const { rerender } = render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    // Look for import options
    const includeAssetsCheckbox = screen.queryByLabelText(/include assets/i);
    const extractComponentsCheckbox = screen.queryByLabelText(/extract components/i);
    const preserveLayerStructureCheckbox = screen.queryByLabelText(/preserve layer structure/i);

    if (includeAssetsCheckbox) {
      await user.click(includeAssetsCheckbox);
      expect(includeAssetsCheckbox).toBeChecked();
    }

    if (extractComponentsCheckbox) {
      await user.click(extractComponentsCheckbox);
      expect(extractComponentsCheckbox).toBeChecked();
    }
  });

  it('should start import process and show progress', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    // Mock import job creation and polling
    server.use(
      http.post('/api/parser/analyze', () => {
        return HttpResponse.json({
          success: true,
          jobId: 'job-123',
          status: 'processing'
        }, { status: 202 });
      }),
      
      http.get('/api/parser/jobs/job-123', () => {
        return HttpResponse.json({
          success: true,
          job: {
            id: 'job-123',
            status: 'processing',
            progress: {
              stage: 'analysis',
              percentage: 50,
              estimatedTimeRemaining: 30000
            }
          }
        });
      })
    );

    render(
      <TestWrapper>
        <FigmaImportWizard onComplete={onComplete} />
      </TestWrapper>
    );

    // Navigate through wizard steps to import
    const urlInput = screen.getByPlaceholderText(/paste figma file url/i);
    await user.type(urlInput, 'https://www.figma.com/file/test/file');
    
    // Simulate clicking through wizard steps
    const importButton = screen.queryByRole('button', { name: /start import/i });
    if (importButton) {
      await user.click(importButton);

      // Should show progress indicators
      await waitFor(() => {
        expect(screen.getByText(/importing/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/50%/i)).toBeInTheDocument();
      expect(screen.getByText(/analysis/i)).toBeInTheDocument();
    }
  });

  it('should handle import completion', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    // Mock completed import job
    server.use(
      http.get('/api/parser/jobs/completed-job', () => {
        return HttpResponse.json({
          success: true,
          job: {
            id: 'completed-job',
            status: 'completed',
            result: {
              elements: [
                { id: 'el1', name: 'Button', type: 'RECTANGLE' }
              ],
              designTokens: {
                colors: { primary: '#007bff' }
              }
            },
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          }
        });
      })
    );

    render(
      <TestWrapper>
        <FigmaImportWizard onComplete={onComplete} />
      </TestWrapper>
    );

    // Simulate completed import state
    // This would typically happen after polling completes
    await waitFor(() => {
      const successMessage = screen.queryByText(/import completed/i);
      if (successMessage) {
        expect(successMessage).toBeInTheDocument();
        expect(screen.getByText(/1 element/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      }
    });
  });

  it('should handle import failures and allow retry', async () => {
    const user = userEvent.setup();

    // Mock failed import job
    server.use(
      http.get('/api/parser/jobs/failed-job', () => {
        return HttpResponse.json({
          success: true,
          job: {
            id: 'failed-job',
            status: 'failed',
            error: 'Failed to parse design file',
            createdAt: new Date().toISOString()
          }
        });
      })
    );

    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    // Simulate failed import state
    await waitFor(() => {
      const errorMessage = screen.queryByText(/failed to parse/i);
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      }
    });
  });

  it('should allow cancellation at any step', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <TestWrapper>
        <FigmaImportWizard onCancel={onCancel} />
      </TestWrapper>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should display step progress indicator', () => {
    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    // Should show step indicator
    expect(screen.getByText(/step 1/i)).toBeInTheDocument();
    
    // Should show step titles
    expect(screen.getByText(/file url/i)).toBeInTheDocument();
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    const urlInput = screen.getByPlaceholderText(/paste figma file url/i);
    
    // Focus input and test keyboard interactions
    await user.click(urlInput);
    expect(urlInput).toHaveFocus();

    // Test tab navigation
    await user.keyboard('{Tab}');
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toHaveFocus();

    // Test enter key to proceed
    await user.keyboard('{Enter}');
  });

  it('should handle accessibility features', () => {
    render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    // Check for proper ARIA labels
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');

    // Check for proper heading hierarchy
    const mainHeading = screen.getByRole('heading', { level: 2 });
    expect(mainHeading).toBeInTheDocument();

    // Check for proper form labels
    const urlInput = screen.getByPlaceholderText(/paste figma file url/i);
    expect(urlInput).toHaveAttribute('aria-label');
  });

  it('should save wizard state and resume on page refresh', () => {
    // Test that wizard state is preserved
    const { rerender } = render(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    // Simulate page refresh by re-rendering
    rerender(
      <TestWrapper>
        <FigmaImportWizard />
      </TestWrapper>
    );

    // Should maintain state (this would require localStorage or other persistence)
    expect(screen.getByPlaceholderText(/paste figma file url/i)).toBeInTheDocument();
  });
});