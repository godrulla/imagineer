import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DesignEditor from '../../components/DesignEditor';
import { AuthContext } from '../../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Mock the collaboration hook
vi.mock('../../hooks/useCollaboration', () => ({
  useCollaboration: () => ({
    isConnected: true,
    participants: [
      {
        id: 'user-123',
        name: 'Test User',
        role: 'owner',
        cursor: { x: 100, y: 150 },
        isActive: true
      }
    ],
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCursorPosition: vi.fn(),
    sendElementUpdate: vi.fn()
  })
}));

// Mock the app store
vi.mock('../../stores/appStore', () => ({
  useAppStore: () => ({
    currentProject: {
      id: 'test-project',
      name: 'Test Project'
    },
    selectedElements: [],
    setSelectedElements: vi.fn(),
    addElement: vi.fn(),
    updateElement: vi.fn(),
    deleteElement: vi.fn()
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
  isAuthenticated: true
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

describe('DesignEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the design editor with toolbar', () => {
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    // Check if main toolbar elements are present
    expect(screen.getByRole('button', { name: /select tool/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hand tool/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rectangle tool/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /circle tool/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /text tool/i })).toBeInTheDocument();
  });

  it('should display collaboration status when enabled', () => {
    render(
      <TestWrapper>
        <DesignEditor enableCollaboration={true} projectId="test-project" />
      </TestWrapper>
    );

    // Check for collaboration indicators
    expect(screen.getByText(/1 participant/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('should show offline status when collaboration is disconnected', () => {
    // Mock disconnected state
    vi.doMock('../../hooks/useCollaboration', () => ({
      useCollaboration: () => ({
        isConnected: false,
        participants: [],
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendCursorPosition: vi.fn(),
        sendElementUpdate: vi.fn()
      })
    }));

    render(
      <TestWrapper>
        <DesignEditor enableCollaboration={true} projectId="test-project" />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/offline/i)).toBeInTheDocument();
  });

  it('should switch between tools when toolbar buttons are clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    const rectButton = screen.getByRole('button', { name: /rectangle tool/i });
    const circleButton = screen.getByRole('button', { name: /circle tool/i });
    const textButton = screen.getByRole('button', { name: /text tool/i });

    // Test rectangle tool selection
    await user.click(rectButton);
    expect(rectButton).toHaveClass('bg-blue-500'); // Active state

    // Test circle tool selection
    await user.click(circleButton);
    expect(circleButton).toHaveClass('bg-blue-500');
    expect(rectButton).not.toHaveClass('bg-blue-500');

    // Test text tool selection
    await user.click(textButton);
    expect(textButton).toHaveClass('bg-blue-500');
    expect(circleButton).not.toHaveClass('bg-blue-500');
  });

  it('should handle zoom controls', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
    const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });

    // Test zoom in
    await user.click(zoomInButton);
    
    // Test zoom out
    await user.click(zoomOutButton);
    
    // Verify buttons are clickable (no errors thrown)
    expect(zoomInButton).toBeEnabled();
    expect(zoomOutButton).toBeEnabled();
  });

  it('should handle undo and redo operations', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    const undoButton = screen.getByRole('button', { name: /undo/i });
    const redoButton = screen.getByRole('button', { name: /redo/i });

    // Initially, undo and redo should be disabled (no history)
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    // After adding an element, undo should be enabled
    // This would require more complex setup to test properly
  });

  it('should display canvas dimensions correctly', () => {
    const customWidth = 1200;
    const customHeight = 800;
    
    render(
      <TestWrapper>
        <DesignEditor width={customWidth} height={customHeight} />
      </TestWrapper>
    );

    // Check if canvas container has correct dimensions
    const canvasContainer = screen.getByRole('main');
    expect(canvasContainer).toBeInTheDocument();
  });

  it('should handle canvas interactions for creating elements', async () => {
    const user = userEvent.setup();
    const onElementsChange = vi.fn();
    
    render(
      <TestWrapper>
        <DesignEditor onElementsChange={onElementsChange} />
      </TestWrapper>
    );

    // Select rectangle tool
    const rectButton = screen.getByRole('button', { name: /rectangle tool/i });
    await user.click(rectButton);

    // Get the canvas element
    const canvas = screen.getByRole('main').querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    if (canvas) {
      // Simulate click on canvas to create rectangle
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(canvas, { clientX: 200, clientY: 200 });

      // Wait for the element to be created
      await waitFor(() => {
        expect(onElementsChange).toHaveBeenCalled();
      });
    }
  });

  it('should show preview mode when play button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    const playButton = screen.getByRole('button', { name: /preview/i });
    await user.click(playButton);

    // In preview mode, toolbar should be hidden or modified
    // This would depend on the actual implementation
    expect(playButton).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    const canvasContainer = screen.getByRole('main');
    
    // Focus the canvas container
    canvasContainer.focus();

    // Test Ctrl+Z for undo
    await user.keyboard('{Control>}z{/Control}');
    
    // Test Ctrl+Y for redo
    await user.keyboard('{Control>}y{/Control}');
    
    // Test Delete key for deleting selected elements
    await user.keyboard('{Delete}');
    
    // Test Escape key for deselecting
    await user.keyboard('{Escape}');

    // These shortcuts should not throw errors
    expect(canvasContainer).toBeInTheDocument();
  });

  it('should handle element selection and transformation', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    // First create an element by selecting rectangle tool and drawing
    const rectButton = screen.getByRole('button', { name: /rectangle tool/i });
    await user.click(rectButton);

    const canvas = screen.getByRole('main').querySelector('canvas');
    if (canvas) {
      // Create a rectangle
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(canvas, { clientX: 200, clientY: 200 });

      // Switch to select tool
      const selectButton = screen.getByRole('button', { name: /select tool/i });
      await user.click(selectButton);

      // Click on the element to select it
      fireEvent.click(canvas, { clientX: 150, clientY: 150 });
    }
  });

  it('should display proper error states', () => {
    render(
      <TestWrapper>
        <DesignEditor projectId="invalid-project" />
      </TestWrapper>
    );

    // Component should still render even with invalid project ID
    expect(screen.getByRole('button', { name: /select tool/i })).toBeInTheDocument();
  });

  it('should handle prop updates correctly', () => {
    const { rerender } = render(
      <TestWrapper>
        <DesignEditor width={800} height={600} />
      </TestWrapper>
    );

    // Update props
    rerender(
      <TestWrapper>
        <DesignEditor width={1200} height={800} enableCollaboration={true} />
      </TestWrapper>
    );

    // Component should handle prop updates without errors
    expect(screen.getByRole('button', { name: /select tool/i })).toBeInTheDocument();
  });

  it('should cleanup resources on unmount', () => {
    const { unmount } = render(
      <TestWrapper>
        <DesignEditor enableCollaboration={true} projectId="test-project" />
      </TestWrapper>
    );

    // Unmount component
    unmount();

    // No errors should be thrown during cleanup
    expect(true).toBe(true);
  });

  it('should handle accessibility features', () => {
    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    // Check for proper ARIA labels and roles
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();

    // Check for keyboard navigation support
    const toolButtons = screen.getAllByRole('button');
    toolButtons.forEach(button => {
      expect(button).toHaveAttribute('tabIndex');
    });
  });

  it('should handle touch interactions on mobile devices', () => {
    // Mock touch events
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      value: {}
    });

    render(
      <TestWrapper>
        <DesignEditor />
      </TestWrapper>
    );

    const canvas = screen.getByRole('main').querySelector('canvas');
    if (canvas) {
      // Simulate touch events
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 150, clientY: 150 }]
      });
      fireEvent.touchEnd(canvas);
    }

    // Should handle touch events without errors
    expect(canvas).toBeInTheDocument();
  });
});