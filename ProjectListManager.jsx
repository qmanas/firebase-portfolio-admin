import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import VercelStorage from '../utils/vercelStorage';
import { cacheUtils } from '../utils/cacheUtils';
import ProjectLogo from './ProjectLogo';

const ProjectListEditor = () => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState({});
  const [editingProject, setEditingProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const projectsRef = collection(db, 'projects');
      const q = query(projectsRef, orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date
      }));
      
      setProjects(projectsData);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const toggleProjectVisibility = async (projectId, currentStatus) => {
    if (!currentUser) return;
    
    setUpdating(prev => ({ ...prev, [projectId]: 'visibility' }));
    
    try {
      const projectRef = doc(db, 'projects', projectId);
      const newStatus = !currentStatus;
      
      await updateDoc(projectRef, {
        hidden: newStatus
      });
      
      // Update local state
      setProjects(prev => prev.map(project => 
        project.id === projectId 
          ? { ...project, hidden: newStatus }
          : project
      ));
      
      // Clear cache to ensure fresh data
      cacheUtils.clearCache(cacheUtils.keys.PROJECTS);
      cacheUtils.clearCache(`${cacheUtils.keys.PROJECT}${projectId}`);
      
      console.log(`Project ${projectId} ${newStatus ? 'hidden' : 'shown'}`);
      
    } catch (err) {
      console.error('Error updating project visibility:', err);
      setError('Failed to update project visibility');
    } finally {
      setUpdating(prev => ({ ...prev, [projectId]: null }));
    }
  };

  const deleteProject = async (projectId, projectTitle) => {
    if (!currentUser) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete "${projectTitle}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setUpdating(prev => ({ ...prev, [projectId]: 'deleting' }));
    
    try {
      const projectRef = doc(db, 'projects', projectId);
      await deleteDoc(projectRef);
      
      // Update local state
      setProjects(prev => prev.filter(project => project.id !== projectId));
      
      // Clear cache
      cacheUtils.clearCache(cacheUtils.keys.PROJECTS);
      cacheUtils.clearCache(`${cacheUtils.keys.PROJECT}${projectId}`);
      
      console.log(`Project ${projectId} deleted`);
      
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project');
    } finally {
      setUpdating(prev => ({ ...prev, [projectId]: null }));
    }
  };

  const openEditModal = (project) => {
    setEditingProject(project);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditingProject(null);
    setShowEditModal(false);
  };

  const updateProject = async (updatedProjectData) => {
    if (!currentUser || !editingProject) return;
    
    setUpdating(prev => ({ ...prev, [editingProject.id]: 'updating' }));
    
    try {
      const projectRef = doc(db, 'projects', editingProject.id);
      await updateDoc(projectRef, updatedProjectData);
      
      // Update local state
      setProjects(prev => prev.map(project => 
        project.id === editingProject.id 
          ? { ...project, ...updatedProjectData }
          : project
      ));
      
      // Clear cache
      cacheUtils.clearCache(cacheUtils.keys.PROJECTS);
      cacheUtils.clearCache(`${cacheUtils.keys.PROJECT}${editingProject.id}`);
      
      console.log(`Project ${editingProject.id} updated`);
      closeEditModal();
      
    } catch (err) {
      console.error('Error updating project:', err);
      setError('Failed to update project');
    } finally {
      setUpdating(prev => ({ ...prev, [editingProject.id]: null }));
    }
  };

  if (loading) {
    return (
      <div className="form-container" style={{ maxWidth: 800, margin: '2rem auto' }}>
        <h2 className="form-title">Loading Projects...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-container" style={{ maxWidth: 800, margin: '2rem auto' }}>
        <h2 className="form-title">Project List Editor</h2>
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
        <button onClick={fetchProjects} className="form-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="form-container" style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h2 className="form-title">Project List Editor</h2>
      
      <div style={{ marginBottom: '1rem', color: '#888', fontSize: '0.9rem' }}>
        Manage your projects: edit project details, control visibility, and delete projects. Hidden projects won't appear on the main page.
      </div>
      
      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
          No projects found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projects.map(project => (
            <div 
              key={project.id} 
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                border: '1px solid #333',
                borderRadius: '8px',
                backgroundColor: project.hidden ? '#1a1a1a' : 'transparent',
                opacity: project.hidden ? 0.6 : 1,
                gap: '1rem'
              }}
            >
              {/* Project Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.1rem',
                    textDecoration: project.hidden ? 'line-through' : 'none'
                  }}>
                    {project.title}
                  </h3>
                  {project.featured && (
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      backgroundColor: '#00b894',
                      color: 'white',
                      borderRadius: '4px'
                    }}>
                      FEATURED
                    </span>
                  )}
                  {project.hidden && (
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      borderRadius: '4px'
                    }}>
                      HIDDEN
                    </span>
                  )}
                </div>
                <div style={{ 
                  color: '#888', 
                  fontSize: '0.9rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {project.description}
                </div>
                <div style={{ 
                  color: '#666', 
                  fontSize: '0.8rem',
                  marginTop: '0.5rem'
                }}>
                  {project.category} • {project.year} • {project.technologies?.join(', ')}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {/* Edit Button */}
                <button
                  onClick={() => openEditModal(project)}
                  disabled={updating[project.id] === 'updating'}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #3498db',
                    backgroundColor: 'transparent',
                    color: '#3498db',
                    borderRadius: '4px',
                    cursor: updating[project.id] === 'updating' ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    minWidth: '70px'
                  }}
                  onMouseOver={(e) => {
                    if (!updating[project.id]) {
                      e.target.style.backgroundColor = '#3498db';
                      e.target.style.color = 'white';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!updating[project.id]) {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = '#3498db';
                    }
                  }}
                >
                  {updating[project.id] === 'updating' ? '...' : 'Edit'}
                </button>
                
                {/* Visibility Toggle */}
                <button
                  onClick={() => toggleProjectVisibility(project.id, project.hidden)}
                  disabled={updating[project.id] === 'visibility'}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #333',
                    backgroundColor: project.hidden ? '#00b894' : '#333',
                    color: project.hidden ? 'white' : '#ccc',
                    borderRadius: '4px',
                    cursor: updating[project.id] === 'visibility' ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    minWidth: '70px'
                  }}
                >
                  {updating[project.id] === 'visibility' 
                    ? '...' 
                    : project.hidden 
                      ? 'Show' 
                      : 'Hide'
                  }
                </button>
                
                {/* Delete Button */}
                <button
                  onClick={() => deleteProject(project.id, project.title)}
                  disabled={updating[project.id] === 'deleting'}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #e74c3c',
                    backgroundColor: 'transparent',
                    color: '#e74c3c',
                    borderRadius: '4px',
                    cursor: updating[project.id] === 'deleting' ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    minWidth: '70px'
                  }}
                  onMouseOver={(e) => {
                    if (!updating[project.id]) {
                      e.target.style.backgroundColor = '#e74c3c';
                      e.target.style.color = 'white';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!updating[project.id]) {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = '#e74c3c';
                    }
                  }}
                >
                  {updating[project.id] === 'deleting' ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button 
          onClick={fetchProjects} 
          className="theme-toggle"
          style={{ marginRight: '1rem' }}
        >
          🔄 Refresh List
        </button>
        <span style={{ color: '#666', fontSize: '0.9rem' }}>
          Total: {projects.length} projects ({projects.filter(p => !p.hidden).length} visible, {projects.filter(p => p.hidden).length} hidden)
        </span>
      </div>
      
      {/* Edit Modal */}
      {showEditModal && editingProject && (
        <EditProjectModal
          project={editingProject}
          onSave={updateProject}
          onCancel={closeEditModal}
          isUpdating={updating[editingProject.id] === 'updating'}
        />
      )}
    </div>
  );
};

// Edit Project Modal Component
const EditProjectModal = ({ project, onSave, onCancel, isUpdating }) => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    title: project.title || '',
    description: project.description || '',
    category: project.category || 'tech',
    technologies: project.technologies?.join(', ') || '',
    services: project.services?.join(', ') || '',
    client: project.client || '',
    year: project.year || '2024',
    accentColor: project.accentColor || '#111111',
    githubUrl: project.githubUrl || '',
    liveUrl: project.liveUrl || '',
    featured: project.featured || false,
    involvement: project.involvement || '',
    involvementDescription: project.involvementDescription || '',
    details: {
      challenge: project.details?.challenge || '',
      solution: project.details?.solution || '',
      results: project.details?.results || ''
    }
  });

  // Image-related state
  const [mainImage, setMainImage] = useState(null);
  const [mainImageUrl, setMainImageUrl] = useState(project.imageUrl || '');
  const [logoImage, setLogoImage] = useState(null);
  const [logoUrl, setLogoUrl] = useState(project.logoUrl || '');
  const [gallery, setGallery] = useState(project.images || []);
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Handle main image upload
  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMainImage(file);
    // Preview the image
    const reader = new FileReader();
    reader.onload = (ev) => setMainImageUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Handle logo image upload
  const handleLogoImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoImage(file);
    // Preview the logo
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Handle gallery image selection
  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files);
    const newGallery = files.map(file => ({
      file,
      url: '',
      title: '',
      caption: '',
      type: 'desktop',
      dimensions: '',
      preview: null
    }));
    
    // Auto-detect dimensions for each image
    newGallery.forEach((img, idx) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const image = new window.Image();
        image.onload = () => {
          const dimensions = `${image.width}x${image.height}`;
          setGallery(gallery => [
            ...gallery,
            { ...img, dimensions, preview: ev.target.result }
          ]);
        };
        image.src = ev.target.result;
      };
      reader.readAsDataURL(img.file);
    });
  };

  // Handle gallery image metadata change
  const handleGalleryMetaChange = (idx, field, value) => {
    setGallery(gallery => gallery.map((img, i) => i === idx ? { ...img, [field]: value } : img));
  };

  // Remove gallery image
  const handleRemoveGalleryImage = (idx) => {
    setGallery(gallery => gallery.filter((_, i) => i !== idx));
  };

  // Upload a single image to Vercel Blob Storage
  const uploadImage = async (file, path) => {
    try {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const sanitizedPath = path.replace(/[^a-zA-Z0-9._/-]/g, '_');
      console.log('Uploading to Vercel Blob Storage:', sanitizedPath);
      
      const url = await VercelStorage.uploadFile(file, sanitizedPath);
      console.log('File uploaded successfully:', url);
      
      return url;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      // Provide more helpful error messages
      if (error.code === 'storage/unauthorized') {
        throw new Error('Storage access denied. Check Firebase Storage security rules.');
      } else if (error.code === 'storage/unauthenticated') {
        throw new Error('User not authenticated. Please log in again.');
      } else if (error.code === 'storage/unknown') {
        throw new Error('Storage error: Check Firebase Storage security rules and bucket configuration. See console for details.');
      }
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      // Upload main image if a new one was selected
      let imageUrl = mainImageUrl;
      if (mainImage) {
        const mainImagePath = `projects/main_${Date.now()}_${mainImage.name}`;
        imageUrl = await uploadImage(mainImage, mainImagePath);
      }
      
      // Upload logo image if a new one was selected
      let logoUrlToSave = logoUrl;
      if (logoImage) {
        const logoImagePath = `projects/logo_${Date.now()}_${logoImage.name}`;
        logoUrlToSave = await uploadImage(logoImage, logoImagePath);
      }
      
      // Upload gallery images (only new ones with file property)
      const galleryWithUrls = await Promise.all(gallery.map(async (img, idx) => {
        if (img.file) {
          // This is a new image, upload it
          const galleryImagePath = `projects/gallery_${Date.now()}_${idx}_${img.file.name}`;
          const url = await uploadImage(img.file, galleryImagePath);
          return {
            url,
            title: img.title,
            caption: img.caption,
            type: img.type,
            dimensions: img.dimensions,
          };
        } else {
          // This is an existing image, keep as is
          return {
            url: img.url,
            title: img.title,
            caption: img.caption,
            type: img.type,
            dimensions: img.dimensions,
          };
        }
      }));
      
      // Prepare the data for saving
      const updateData = {
        ...formData,
        technologies: formData.technologies.split(',').map(t => t.trim()).filter(Boolean),
        services: formData.services.split(',').map(s => s.trim()).filter(Boolean),
        imageUrl,
        logoUrl: logoUrlToSave,
        images: galleryWithUrls
      };
      
      onSave(updateData);
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Error updating project: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 className="form-title" style={{ margin: 0 }}>Edit Project</h3>
          <button 
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="tech">Tech</option>
              <option value="media">Media</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Technologies (comma separated)</label>
            <input
              className="form-input"
              name="technologies"
              value={formData.technologies}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Services (comma separated)</label>
            <input
              className="form-input"
              name="services"
              value={formData.services}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Client</label>
            <input
              className="form-input"
              name="client"
              value={formData.client}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Year</label>
            <input
              className="form-input"
              type="number"
              name="year"
              value={formData.year}
              onChange={handleChange}
              min="2000"
              max="2030"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Accent Color</label>
            <input
              className="color-picker"
              type="color"
              name="accentColor"
              value={formData.accentColor}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Logo Image</label>
            <input type="file" accept="image/*" onChange={handleLogoImageChange} />
            {logoUrl && (
              <div style={{ marginTop: '8px' }}>
                <ProjectLogo 
                  logoUrl={logoUrl}
                  title="Logo preview"
                  size={80}
                  style={{
                    background: '#f4f4f4',
                    border: '1px solid #333'
                  }}
                />
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                  {logoImage ? 'New logo selected' : 'Current logo'}
                </div>
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
              Logo will appear next to the project title on the home page
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Main Image</label>
            <input type="file" accept="image/*" onChange={handleMainImageChange} />
            {mainImageUrl && (
              <div style={{ marginTop: '8px' }}>
                <img 
                  src={mainImageUrl} 
                  alt="Main preview" 
                  style={{ 
                    width: '120px', 
                    height: '90px', 
                    objectFit: 'cover', 
                    borderRadius: '6px',
                    border: '1px solid #333'
                  }} 
                />
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                  {mainImage ? 'New image selected' : 'Current image'}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Gallery Images</label>
            <input type="file" accept="image/*" multiple onChange={handleGalleryChange} />
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
              Select multiple images to add to the gallery
            </div>
            
            {gallery.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {gallery.map((img, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px', 
                    border: '1px solid #333', 
                    borderRadius: '6px', 
                    padding: '8px' 
                  }}>
                    {(img.preview || img.url) && (
                      <img 
                        src={img.preview || img.url} 
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          objectFit: 'cover', 
                          borderRadius: '4px' 
                        }} 
                        alt={`Gallery ${idx+1}`} 
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <input 
                        className="form-input" 
                        placeholder="Title" 
                        value={img.title || ''} 
                        onChange={e => handleGalleryMetaChange(idx, 'title', e.target.value)} 
                        style={{ marginBottom: '4px' }} 
                      />
                      <input 
                        className="form-input" 
                        placeholder="Caption" 
                        value={img.caption || ''} 
                        onChange={e => handleGalleryMetaChange(idx, 'caption', e.target.value)} 
                        style={{ marginBottom: '4px' }} 
                      />
                      <select 
                        className="form-select" 
                        value={img.type || 'desktop'} 
                        onChange={e => handleGalleryMetaChange(idx, 'type', e.target.value)} 
                        style={{ marginBottom: '4px' }}
                      >
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                      </select>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        Dimensions: {img.dimensions || 'Unknown'}
                        {img.file && <span style={{ color: '#00b894' }}> • New</span>}
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="theme-toggle" 
                      onClick={() => handleRemoveGalleryImage(idx)} 
                      style={{ height: '32px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">GitHub URL</label>
            <input
              className="form-input"
              name="githubUrl"
              value={formData.githubUrl}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Live URL</label>
            <input
              className="form-input"
              name="liveUrl"
              value={formData.liveUrl}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                name="featured"
                checked={formData.featured}
                onChange={handleChange}
                style={{ marginRight: '0.5rem' }}
              />
              Featured
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Involvement Title</label>
            <input
              className="form-input"
              name="involvement"
              value={formData.involvement}
              onChange={handleChange}
              placeholder="e.g., Lead Developer, Technical Lead"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Involvement Description</label>
            <textarea
              className="form-textarea"
              name="involvementDescription"
              value={formData.involvementDescription}
              onChange={handleChange}
              placeholder="Describe your role and contributions to this project..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Challenge</label>
            <textarea
              className="form-textarea"
              name="details.challenge"
              value={formData.details.challenge}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Solution</label>
            <textarea
              className="form-textarea"
              name="details.solution"
              value={formData.details.solution}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Results</label>
            <textarea
              className="form-textarea"
              name="details.results"
              value={formData.details.results}
              onChange={handleChange}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button
              type="submit"
              className="form-button"
              disabled={isUpdating || uploading}
              style={{ flex: 1 }}
            >
              {uploading ? 'Uploading Images...' : isUpdating ? 'Updating...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="theme-toggle"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectListEditor;
