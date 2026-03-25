import { http, HttpResponse } from 'msw';

export const mockHandlers = [
  // Figma API mocks
  http.get('https://api.figma.com/v1/files/:fileId', ({ params }) => {
    const { fileId } = params;
    
    if (fileId === 'error-file') {
      return HttpResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json({
      document: {
        id: fileId,
        name: 'Test Design File',
        type: 'DOCUMENT',
        children: [
          {
            id: 'page1',
            name: 'Page 1',
            type: 'CANVAS',
            children: [
              {
                id: 'frame1',
                name: 'Main Frame',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 600 },
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                constraints: { horizontal: 'LEFT_RIGHT', vertical: 'TOP_BOTTOM' },
                children: [
                  {
                    id: 'button1',
                    name: 'Primary Button',
                    type: 'RECTANGLE',
                    absoluteBoundingBox: { x: 50, y: 50, width: 120, height: 40 },
                    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
                    cornerRadius: 6,
                    constraints: { horizontal: 'LEFT', vertical: 'TOP' }
                  },
                  {
                    id: 'text1',
                    name: 'Button Text',
                    type: 'TEXT',
                    absoluteBoundingBox: { x: 65, y: 60, width: 90, height: 20 },
                    characters: 'Click Me',
                    style: {
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: 500,
                      textAlignHorizontal: 'CENTER',
                      textAlignVertical: 'CENTER'
                    },
                    constraints: { horizontal: 'LEFT', vertical: 'TOP' }
                  },
                  {
                    id: 'card1',
                    name: 'Content Card',
                    type: 'FRAME',
                    absoluteBoundingBox: { x: 200, y: 50, width: 300, height: 200 },
                    fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }],
                    cornerRadius: 8,
                    constraints: { horizontal: 'LEFT', vertical: 'TOP' },
                    children: [
                      {
                        id: 'heading1',
                        name: 'Card Title',
                        type: 'TEXT',
                        absoluteBoundingBox: { x: 220, y: 70, width: 260, height: 30 },
                        characters: 'Card Title',
                        style: {
                          fontFamily: 'Inter',
                          fontSize: 24,
                          fontWeight: 600,
                          textAlignHorizontal: 'LEFT'
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      lastModified: new Date().toISOString(),
      thumbnailUrl: 'https://figma-alpha-api.s3.us-west-2.amazonaws.com/test-thumbnail.png',
      version: '1.0'
    });
  }),

  http.get('https://api.figma.com/v1/files/:fileId/nodes', ({ params, request }) => {
    const { fileId } = params;
    const url = new URL(request.url);
    const nodeIds = url.searchParams.get('ids')?.split(',') || [];
    
    const nodes: Record<string, any> = {};
    
    nodeIds.forEach(nodeId => {
      if (nodeId === 'error-node') {
        nodes[nodeId] = null;
        return;
      }
      
      nodes[nodeId] = {
        document: {
          id: nodeId,
          name: `Test Node ${nodeId}`,
          type: 'FRAME',
          absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
          fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }],
          constraints: { horizontal: 'LEFT', vertical: 'TOP' },
          children: [
            {
              id: `${nodeId}-child`,
              name: 'Child Element',
              type: 'RECTANGLE',
              absoluteBoundingBox: { x: 20, y: 20, width: 100, height: 50 },
              fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }]
            }
          ]
        }
      };
    });
    
    return HttpResponse.json({ nodes });
  }),

  // Figma API error scenarios
  http.get('https://api.figma.com/v1/files/unauthorized', () => {
    return HttpResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }),

  http.get('https://api.figma.com/v1/files/rate-limited', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }),

  // Mock external image processing APIs
  http.post('https://api.remove.bg/v1.0/removebg', () => {
    return HttpResponse.arrayBuffer(new ArrayBuffer(1024), {
      headers: {
        'Content-Type': 'image/png'
      }
    });
  }),

  // Health check
  http.get('*/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  })
];