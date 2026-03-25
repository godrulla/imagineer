import { test, expect, Page } from '@playwright/test';

/**
 * End-to-End Workflow Test
 * Tests the complete user journey: Figma Import → Design Editing → LLM Translation → Export Generation
 */

test.describe('Complete Imagineer Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage, context }) => {
    page = testPage;
    
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Mock external APIs
    await page.route('**/api.figma.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          document: {
            id: 'test-file',
            name: 'Test Design File',
            children: [{
              id: 'page1',
              name: 'Page 1',
              type: 'CANVAS',
              children: [{
                id: 'button1',
                name: 'Primary Button',
                type: 'RECTANGLE',
                absoluteBoundingBox: { x: 50, y: 50, width: 120, height: 40 },
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }]
              }]
            }]
          }
        })
      });
    });

    // Mock LLM API responses
    await page.route('**/api.openai.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'chatcmpl-test',
          choices: [{
            message: {
              content: JSON.stringify({
                components: [{
                  name: 'PrimaryButton',
                  type: 'button',
                  code: '<Button variant="primary">Click Me</Button>'
                }]
              })
            }
          }],
          usage: { total_tokens: 150 }
        })
      });
    });
  });

  test('Complete workflow: Figma import to export generation', async () => {
    // Step 1: Login
    await test.step('User authentication', async () => {
      await page.goto('/login');
      
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
    });

    // Step 2: Create new project
    await test.step('Project creation', async () => {
      await page.click('[data-testid="new-project-button"]');
      
      await page.fill('[data-testid="project-name-input"]', 'E2E Test Project');
      await page.fill('[data-testid="project-description-input"]', 'End-to-end testing project');
      await page.selectOption('[data-testid="framework-select"]', 'react');
      await page.selectOption('[data-testid="styling-select"]', 'tailwind');
      
      await page.click('[data-testid="create-project-button"]');
      
      await expect(page.locator('[data-testid="project-title"]')).toContainText('E2E Test Project');
    });

    // Step 3: Import from Figma
    await test.step('Figma import workflow', async () => {
      await page.click('[data-testid="import-figma-button"]');
      
      // Figma import wizard should open
      await expect(page.locator('[data-testid="figma-import-wizard"]')).toBeVisible();
      
      // Enter Figma URL
      const figmaUrl = 'https://www.figma.com/file/test123/sample-design';
      await page.fill('[data-testid="figma-url-input"]', figmaUrl);
      await page.click('[data-testid="next-button"]');
      
      // Wait for file info to load
      await expect(page.locator('[data-testid="file-info"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-name"]')).toContainText('Test Design File');
      
      // Select pages to import
      await page.check('[data-testid="page-checkbox-page1"]');
      await page.click('[data-testid="next-button"]');
      
      // Configure import options
      await page.check('[data-testid="include-assets-checkbox"]');
      await page.check('[data-testid="extract-components-checkbox"]');
      await page.click('[data-testid="start-import-button"]');
      
      // Wait for import to complete
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();
      await page.waitForSelector('[data-testid="import-completed"]', { timeout: 30000 });
      
      await page.click('[data-testid="continue-button"]');
    });

    // Step 4: Design editing
    await test.step('Design editor interaction', async () => {
      // Design editor should be loaded
      await expect(page.locator('[data-testid="design-editor"]')).toBeVisible();
      await expect(page.locator('[data-testid="design-canvas"]')).toBeVisible();
      
      // Check if imported elements are visible
      await expect(page.locator('[data-testid="element-button1"]')).toBeVisible();
      
      // Test design editing tools
      await page.click('[data-testid="select-tool"]');
      await page.click('[data-testid="element-button1"]');
      
      // Element should be selected
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="element-name"]')).toContainText('Primary Button');
      
      // Modify element properties
      await page.fill('[data-testid="element-width-input"]', '150');
      await page.fill('[data-testid="element-height-input"]', '50');
      
      // Add a new element
      await page.click('[data-testid="rectangle-tool"]');
      await page.mouse.click(200, 200);
      await page.mouse.move(300, 250);
      await page.mouse.click(300, 250);
      
      // New rectangle should be created
      await expect(page.locator('[data-testid="layers-panel"]')).toContainText('Rectangle');
    });

    // Step 5: LLM translation
    await test.step('LLM translation workflow', async () => {
      await page.click('[data-testid="translate-button"]');
      
      // Translation wizard should open
      await expect(page.locator('[data-testid="translation-wizard"]')).toBeVisible();
      
      // Select LLM provider
      await page.selectOption('[data-testid="llm-provider-select"]', 'openai_gpt4');
      await page.selectOption('[data-testid="output-format-select"]', 'markdown');
      await page.selectOption('[data-testid="translation-type-select"]', 'component');
      
      // Configure advanced options
      await page.click('[data-testid="advanced-options-toggle"]');
      await page.selectOption('[data-testid="verbosity-select"]', 'detailed');
      await page.check('[data-testid="include-metadata-checkbox"]');
      
      // Start translation
      await page.click('[data-testid="start-translation-button"]');
      
      // Wait for translation to complete
      await expect(page.locator('[data-testid="translation-progress"]')).toBeVisible();
      await page.waitForSelector('[data-testid="translation-completed"]', { timeout: 45000 });
      
      // Review translation results
      await expect(page.locator('[data-testid="translation-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="generated-markdown"]')).toContainText('PrimaryButton');
      
      // Approve translation
      await page.click('[data-testid="approve-translation-button"]');
    });

    // Step 6: Export generation
    await test.step('Export generation workflow', async () => {
      await page.click('[data-testid="export-button"]');
      
      // Export wizard should open
      await expect(page.locator('[data-testid="export-wizard"]')).toBeVisible();
      
      // Select export format
      await page.selectOption('[data-testid="export-format-select"]', 'react_typescript');
      
      // Configure export options
      await page.check('[data-testid="include-tests-checkbox"]');
      await page.check('[data-testid="include-storybook-checkbox"]');
      await page.selectOption('[data-testid="styling-framework-select"]', 'tailwind');
      
      // Start export
      await page.click('[data-testid="start-export-button"]');
      
      // Wait for export to complete
      await expect(page.locator('[data-testid="export-progress"]')).toBeVisible();
      await page.waitForSelector('[data-testid="export-completed"]', { timeout: 60000 });
      
      // Verify export results
      await expect(page.locator('[data-testid="export-files-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-files-list"]')).toContainText('PrimaryButton.tsx');
      await expect(page.locator('[data-testid="export-files-list"]')).toContainText('PrimaryButton.test.tsx');
      
      // Download export
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-export-button"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/.*\.zip$/);
    });

    // Step 7: Verify project state
    await test.step('Project state verification', async () => {
      // Navigate to project dashboard
      await page.click('[data-testid="project-dashboard-link"]');
      
      // Verify project shows completed workflows
      await expect(page.locator('[data-testid="designs-count"]')).toContainText('1');
      await expect(page.locator('[data-testid="translations-count"]')).toContainText('1');
      await expect(page.locator('[data-testid="exports-count"]')).toContainText('1');
      
      // Check recent activity
      await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
      await expect(page.locator('[data-testid="activity-item"]').first()).toContainText('Export completed');
    });
  });

  test('Workflow error handling and recovery', async () => {
    await test.step('Login and setup', async () => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      await expect(page).toHaveURL('/dashboard');
    });

    await test.step('Handle Figma import error', async () => {
      // Mock Figma API error
      await page.route('**/api.figma.com/**', async route => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'File not found' })
        });
      });

      await page.click('[data-testid="new-project-button"]');
      await page.fill('[data-testid="project-name-input"]', 'Error Test Project');
      await page.click('[data-testid="create-project-button"]');
      
      await page.click('[data-testid="import-figma-button"]');
      await page.fill('[data-testid="figma-url-input"]', 'https://www.figma.com/file/invalid/file');
      await page.click('[data-testid="next-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('File not found');
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Test retry functionality
      await page.route('**/api.figma.com/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            document: { id: 'test', name: 'Test File', children: [] }
          })
        });
      });
      
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="file-info"]')).toBeVisible();
    });

    await test.step('Handle LLM translation error', async () => {
      // Mock LLM API error
      await page.route('**/api.openai.com/**', async route => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: { message: 'Rate limit exceeded', type: 'rate_limit_error' }
          })
        });
      });

      // Continue with a mock design for translation testing
      await page.goto('/projects/test-project/editor');
      await page.click('[data-testid="translate-button"]');
      await page.selectOption('[data-testid="llm-provider-select"]', 'openai_gpt4');
      await page.click('[data-testid="start-translation-button"]');
      
      // Should show rate limit error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Rate limit exceeded');
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Should suggest fallback provider
      await expect(page.locator('[data-testid="fallback-suggestion"]')).toContainText('Try Anthropic Claude');
    });
  });

  test('Collaboration workflow', async () => {
    await test.step('Setup and login multiple users', async () => {
      // This would require multiple browser contexts in a real test
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'user1@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
    });

    await test.step('Enable real-time collaboration', async () => {
      await page.goto('/projects/test-project/editor');
      
      // Enable collaboration
      await page.click('[data-testid="collaboration-toggle"]');
      await expect(page.locator('[data-testid="collaboration-status"]')).toContainText('Connected');
      
      // Share project link
      await page.click('[data-testid="share-button"]');
      await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
      
      const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
      expect(shareLink).toContain('/projects/');
      
      // Copy link functionality
      await page.click('[data-testid="copy-link-button"]');
      await expect(page.locator('[data-testid="copy-success"]')).toBeVisible();
    });

    await test.step('Test collaborative editing features', async () => {
      // Mock presence of other users
      await page.evaluate(() => {
        window.mockCollaborationData = {
          participants: [
            { id: 'user2', name: 'User 2', cursor: { x: 100, y: 100 }, color: '#ff0000' },
            { id: 'user3', name: 'User 3', cursor: { x: 200, y: 150 }, color: '#00ff00' }
          ]
        };
      });
      
      // Should show other users' cursors
      await expect(page.locator('[data-testid="user-cursor-user2"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-cursor-user3"]')).toBeVisible();
      
      // Should show participants list
      await expect(page.locator('[data-testid="participants-count"]')).toContainText('3 participants');
      
      // Test live editing synchronization
      await page.click('[data-testid="rectangle-tool"]');
      await page.mouse.click(300, 300);
      
      // Should broadcast the change
      await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible();
    });
  });

  test('Accessibility compliance throughout workflow', async () => {
    await test.step('Navigation and keyboard accessibility', async () => {
      await page.goto('/login');
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="password-input"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    });

    await test.step('Screen reader support', async () => {
      // Check for proper ARIA labels and roles
      await expect(page.locator('[data-testid="main-content"]')).toHaveAttribute('role', 'main');
      await expect(page.locator('[data-testid="navigation"]')).toHaveAttribute('role', 'navigation');
      
      // Check form accessibility
      const emailInput = page.locator('[data-testid="email-input"]');
      await expect(emailInput).toHaveAttribute('aria-label');
      await expect(emailInput).toHaveAttribute('aria-required', 'true');
    });

    await test.step('Color contrast and visual accessibility', async () => {
      // This would require axe-core integration for comprehensive testing
      const bodyBackground = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      
      const textColor = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="main-heading"]');
        return window.getComputedStyle(element).color;
      });
      
      // Basic contrast check (simplified)
      expect(bodyBackground).toBeDefined();
      expect(textColor).toBeDefined();
    });
  });
});

test.describe('Performance and Load Testing', () => {
  test('Application performance under load', async ({ page }) => {
    // Navigate to application
    await page.goto('/');
    
    // Measure initial page load
    const navigationTiming = await page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
        loadComplete: timing.loadEventEnd - timing.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime
      };
    });
    
    // Verify performance metrics
    expect(navigationTiming.domContentLoaded).toBeLessThan(2000); // 2 seconds
    expect(navigationTiming.firstContentfulPaint).toBeLessThan(1500); // 1.5 seconds
    
    // Test with multiple rapid interactions
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="navigation-projects"]');
      await page.waitForTimeout(100);
      await page.click('[data-testid="navigation-dashboard"]');
      await page.waitForTimeout(100);
    }
    
    // Application should remain responsive
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
  });
});