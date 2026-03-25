const express = require('express');
const cors = require('cors');
const app = express();

// In-memory data store for demo
let projects = [
  {
    id: 'proj_1',
    name: 'Imagineer Platform',
    description: 'Revolutionary design-to-LLM translation platform',
    created_at: new Date('2024-01-15').toISOString(),
    updated_at: new Date().toISOString(),
    designs_count: 5,
    status: 'active',
    owner_id: '1',
    figma_file_id: 'fig_abc123',
    tags: ['platform', 'ai', 'design'],
    collaborators: [
      { id: '1', name: 'Armando Diaz', role: 'owner', avatar: null },
      { id: '2', name: 'Design Team', role: 'editor', avatar: null }
    ]
  },
  {
    id: 'proj_2', 
    name: 'ReppingDR Platform',
    description: 'Dominican Republic marketplace platform',
    created_at: new Date('2024-02-01').toISOString(),
    updated_at: new Date().toISOString(),
    designs_count: 8,
    status: 'active',
    owner_id: '1',
    figma_file_id: 'fig_def456',
    tags: ['marketplace', 'ecommerce', 'dr'],
    collaborators: [
      { id: '1', name: 'Armando Diaz', role: 'owner', avatar: null }
    ]
  },
  {
    id: 'proj_3',
    name: 'Exxede Dashboard',
    description: 'Investment tracking and analytics dashboard',
    created_at: new Date('2024-01-20').toISOString(),
    updated_at: new Date().toISOString(),
    designs_count: 12,
    status: 'active',
    owner_id: '1',
    figma_file_id: 'fig_ghi789',
    tags: ['dashboard', 'analytics', 'fintech'],
    collaborators: [
      { id: '1', name: 'Armando Diaz', role: 'owner', avatar: null },
      { id: '3', name: 'Dev Team', role: 'viewer', avatar: null }
    ]
  }
];

let designs = [
  {
    id: 'design_1',
    name: 'Landing Page Hero Section',
    project_id: 'proj_1',
    figma_url: 'https://figma.com/file/abc123/hero',
    figma_node_id: '1:123',
    created_at: new Date('2024-01-16').toISOString(),
    updated_at: new Date().toISOString(),
    status: 'completed',
    translation_status: 'ready',
    accuracy_score: 0.94,
    export_formats: ['markdown', 'json'],
    thumbnail: '/assets/thumbnails/hero.png'
  },
  {
    id: 'design_2',
    name: 'Dashboard Navigation',
    project_id: 'proj_1', 
    figma_url: 'https://figma.com/file/abc123/nav',
    figma_node_id: '1:124',
    created_at: new Date('2024-01-17').toISOString(),
    updated_at: new Date().toISOString(),
    status: 'in_progress',
    translation_status: 'translating',
    accuracy_score: 0.87,
    export_formats: ['markdown'],
    thumbnail: '/assets/thumbnails/nav.png'
  },
  {
    id: 'design_3',
    name: 'Product Card Component',
    project_id: 'proj_2',
    figma_url: 'https://figma.com/file/def456/card',
    figma_node_id: '2:125',
    created_at: new Date('2024-02-02').toISOString(),
    updated_at: new Date().toISOString(),
    status: 'completed',
    translation_status: 'ready',
    accuracy_score: 0.91,
    export_formats: ['markdown', 'json', 'react'],
    thumbnail: '/assets/thumbnails/card.png'
  }
];

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Body:`, req.body);
  next();
});

// Mock auth endpoints
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Demo login - accept any credentials for demo
  if (email && password) {
    const response = {
      tokens: {
        access_token: 'demo-jwt-token-' + Date.now(),
        refresh_token: 'demo-refresh-token-' + Date.now(),
        expires_in: 3600
      },
      user: {
        id: '1',
        name: 'Armando Diaz',
        email: email,
        role: 'admin',
        current_organization_id: 'org-1',
        organization_id: 'org-1',
        organizations: [{
          id: 'org-1',
          name: 'Exxede Investments',
          slug: 'exxede',
          plan: 'enterprise'
        }]
      }
    };
    console.log('Sending login response:', JSON.stringify(response, null, 2));
    res.json(response);
  } else {
    res.status(400).json({ error: 'Email and password required' });
  }
});

app.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  
  if (name && email && password) {
    res.json({
      tokens: {
        access_token: 'demo-jwt-token-' + Date.now(),
        refresh_token: 'demo-refresh-token-' + Date.now(),
        expires_in: 3600
      },
      user: {
        id: '2',
        name: name,
        email: email,
        role: 'user',
        organization_id: 'org-2'
      },
      organizations: [{
        id: 'org-2',
        name: name + "'s Organization",
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        plan: 'free'
      }]
    });
  } else {
    res.status(400).json({ error: 'Name, email and password required' });
  }
});

app.get('/auth/me', (req, res) => {
  // Return demo user with full structure
  res.json({
    id: '1',
    name: 'Armando Diaz',
    email: 'armando@exxede.com',
    role: 'admin',
    current_organization_id: 'org-1',
    organization_id: 'org-1',
    organizations: [{
      id: 'org-1',
      name: 'Exxede Investments',
      slug: 'exxede',
      plan: 'enterprise'
    }]
  });
});

app.post('/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// Project Management API
app.get('/api/v1/projects', (req, res) => {
  const { search, status, sort = 'updated_at' } = req.query;
  let filteredProjects = [...projects];
  
  if (search) {
    filteredProjects = filteredProjects.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  if (status) {
    filteredProjects = filteredProjects.filter(p => p.status === status);
  }
  
  // Sort by specified field
  filteredProjects.sort((a, b) => new Date(b[sort]) - new Date(a[sort]));
  
  res.json({
    data: filteredProjects,
    total: filteredProjects.length,
    meta: {
      total_designs: designs.length,
      active_projects: projects.filter(p => p.status === 'active').length
    }
  });
});

app.get('/api/v1/projects/:id', (req, res) => {
  const project = projects.find(p => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const projectDesigns = designs.filter(d => d.project_id === req.params.id);
  
  res.json({
    ...project,
    designs: projectDesigns,
    stats: {
      total_designs: projectDesigns.length,
      completed_designs: projectDesigns.filter(d => d.status === 'completed').length,
      in_progress_designs: projectDesigns.filter(d => d.status === 'in_progress').length,
      avg_accuracy: projectDesigns.reduce((acc, d) => acc + (d.accuracy_score || 0), 0) / projectDesigns.length
    }
  });
});

app.post('/api/v1/projects', (req, res) => {
  const { name, description, figma_file_id, tags = [] } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  const newProject = {
    id: 'proj_' + Date.now(),
    name,
    description: description || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    designs_count: 0,
    status: 'active',
    owner_id: '1',
    figma_file_id: figma_file_id || null,
    tags: Array.isArray(tags) ? tags : [],
    collaborators: [
      { id: '1', name: 'Armando Diaz', role: 'owner', avatar: null }
    ]
  };
  
  projects.push(newProject);
  
  res.status(201).json({
    message: 'Project created successfully',
    project: newProject
  });
});

app.put('/api/v1/projects/:id', (req, res) => {
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const updatedProject = {
    ...projects[projectIndex],
    ...req.body,
    updated_at: new Date().toISOString()
  };
  
  projects[projectIndex] = updatedProject;
  
  res.json({
    message: 'Project updated successfully',
    project: updatedProject
  });
});

app.delete('/api/v1/projects/:id', (req, res) => {
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Remove project and its designs
  projects.splice(projectIndex, 1);
  designs = designs.filter(d => d.project_id !== req.params.id);
  
  res.json({
    message: 'Project deleted successfully'
  });
});

// Design Management API
app.get('/api/v1/designs', (req, res) => {
  const { project_id, status, search } = req.query;
  let filteredDesigns = [...designs];
  
  if (project_id) {
    filteredDesigns = filteredDesigns.filter(d => d.project_id === project_id);
  }
  
  if (status) {
    filteredDesigns = filteredDesigns.filter(d => d.status === status);
  }
  
  if (search) {
    filteredDesigns = filteredDesigns.filter(d => 
      d.name.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({
    data: filteredDesigns,
    total: filteredDesigns.length
  });
});

app.get('/api/v1/designs/:id', (req, res) => {
  const design = designs.find(d => d.id === req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  
  res.json(design);
});

app.post('/api/v1/designs', (req, res) => {
  const { name, project_id, figma_url, figma_node_id } = req.body;
  
  if (!name || !project_id) {
    return res.status(400).json({ error: 'Name and project_id are required' });
  }
  
  const newDesign = {
    id: 'design_' + Date.now(),
    name,
    project_id,
    figma_url: figma_url || null,
    figma_node_id: figma_node_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'draft',
    translation_status: 'pending',
    accuracy_score: null,
    export_formats: [],
    thumbnail: null
  };
  
  designs.push(newDesign);
  
  // Update project designs count
  const project = projects.find(p => p.id === project_id);
  if (project) {
    project.designs_count = designs.filter(d => d.project_id === project_id).length;
    project.updated_at = new Date().toISOString();
  }
  
  res.status(201).json({
    message: 'Design created successfully',
    design: newDesign
  });
});

app.get('/api/v1/templates', (req, res) => {
  res.json({
    data: [
      {
        id: '1',
        name: 'React Component',
        description: 'Generate React components from designs',
        category: 'frontend',
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Flutter Widget',
        description: 'Generate Flutter widgets from designs',
        category: 'mobile',
        created_at: new Date().toISOString()
      }
    ],
    total: 2
  });
});

const PORT = 8090;

app.listen(PORT, () => {
  console.log(`🚀 Simple API Gateway running on http://localhost:${PORT}`);
  console.log('📝 Demo mode - accepting any login credentials');
  console.log('🔗 Frontend can connect to this gateway');
});