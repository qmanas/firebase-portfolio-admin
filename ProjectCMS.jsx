import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import VercelStorage from '../utils/vercelStorage';
import DummyDataUploader from './DummyDataUploader';
import ProjectListEditor from './ProjectListEditor';
import { cacheUtils } from '../utils/cacheUtils';
import ProjectLogo from './ProjectLogo';
import SkillsAdmin from './SkillsAdmin';
import { slugify } from '../utils/skillsAnalyzer';

const initialGalleryImage = {
  file: null,
  url: '',
  title: '',
  caption: '',
  type: 'desktop',
  dimensions: '',
  uploading: false,
  error: '',
};

const ProjectAdminForm = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('tech');
  const [technologies, setTechnologies] = useState('');
  const [services, setServices] = useState('');
  const [client, setClient] = useState('');
  const [year, setYear] = useState('2024');
  const [accentColor, setAccentColor] = useState('#111111');
  const [mainImage, setMainImage] = useState(null);
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [logoImage, setLogoImage] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [featured, setFeatured] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [details, setDetails] = useState({ challenge: '', solution: '', results: '' });
  const [involvement, setInvolvement] = useState('');
  const [involvementDescription, setInvolvementDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  // Handle gallery image selection
  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files);
    const newGallery = files.map(file => ({ ...initialGalleryImage, file }));
    // Auto-detect dimensions for each image
    newGallery.forEach((img, idx) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const image = new window.Image();
        image.onload = () => {
          const dimensions = `${image.width}x${image.height}`;
          setGallery(gallery => {
            const updated = [...gallery, { ...img, dimensions, preview: ev.target.result }];
            return updated;
          });
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

  // Handle main image upload
  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMainImage(file);
    // Optionally preview
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

  // Upload a single image to Vercel Blob Storage
  const uploadImage = async (file, path) => {
    try {
      console.log('Starting upload to Vercel Blob Storage for:', path);
      console.log('File size:', file.size, 'bytes');
      console.log('File type:', file.type);
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Sanitize the path to remove special characters
      const sanitizedPath = path.replace(/[^a-zA-Z0-9._/-]/g, '_');
      console.log('Sanitized path:', sanitizedPath);
      
      console.log('Uploading file to Vercel Blob Storage...');
      const url = await VercelStorage.uploadFile(file, sanitizedPath);
      
      console.log('File uploaded successfully:', url);
      return url;
      
    } catch (error) {
      console.error('Error in uploadImage:', error);
      console.error('Error message:', error.message);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      // Provide helpful error messages
      if (error.message.includes('401')) {
        throw new Error('Authentication failed. Please check your Vercel Blob token.');
      } else if (error.message.includes('403')) {
        throw new Error('Access denied. Check your Vercel Blob permissions.');
      } else if (error.message.includes('413')) {
        throw new Error('File too large. Please reduce the file size.');
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('Starting project submission...');
      console.log('Current user:', currentUser);
      console.log('User authenticated:', !!currentUser);
      
      // Test mode: skip image uploads to isolate the issue
      const testMode = false; // Set to true to skip uploads
      
      if (testMode) {
        console.log('TEST MODE: Skipping image uploads');
        const projectData = {
          title,
          slug: slugify(title),
          description,
          category,
          technologies: technologies.split(',').map(t => t.trim()).filter(Boolean),
          accentColor,
          imageUrl: '',
          githubUrl,
          liveUrl,
          featured,
          date: Timestamp.now(),
          details,
          images: [],
        };
        
        console.log('Saving to Firestore (test mode)...', projectData);
        const docRef = await addDoc(collection(db, 'projects'), projectData);
        console.log('Project saved with ID:', docRef.id);
        setSuccess('Project added successfully! (Test mode)');
        return;
      }
      
      // Upload main image
      let mainImageUrlToSave = '';
      if (mainImage) {
        console.log('Uploading main image...');
        const mainImagePath = `projects/main_${Date.now()}_${mainImage.name}`;
        console.log('Main image path:', mainImagePath);
        mainImageUrlToSave = await uploadImage(mainImage, mainImagePath);
        console.log('Main image uploaded:', mainImageUrlToSave);
      }
      
      // Upload logo image
      let logoUrlToSave = '';
      if (logoImage) {
        console.log('Uploading logo image...');
        const logoImagePath = `projects/logo_${Date.now()}_${logoImage.name}`;
        console.log('Logo image path:', logoImagePath);
        logoUrlToSave = await uploadImage(logoImage, logoImagePath);
        console.log('Logo image uploaded:', logoUrlToSave);
      }
      
      // Upload gallery images
      console.log('Uploading gallery images...', gallery.length);
      const galleryWithUrls = await Promise.all(gallery.map(async (img, idx) => {
        console.log(`Uploading gallery image ${idx + 1}/${gallery.length}...`);
        const galleryImagePath = `projects/gallery_${Date.now()}_${idx}_${img.file.name}`;
        console.log('Gallery image path:', galleryImagePath);
        const url = await uploadImage(img.file, galleryImagePath);
        console.log(`Gallery image ${idx + 1} uploaded:`, url);
        return {
          url,
          title: img.title,
          caption: img.caption,
          type: img.type,
          dimensions: img.dimensions,
        };
      }));
      
      console.log('All images uploaded, preparing project data...');
      
      // Prepare project data
      const projectData = {
        title,
        slug: slugify(title),
        description,
        category,
        technologies: technologies.split(',').map(t => t.trim()).filter(Boolean),
        services: services.split(',').map(s => s.trim()).filter(Boolean),
        client,
        year,
        accentColor,
        imageUrl: mainImageUrlToSave,
        logoUrl: logoUrlToSave,
        githubUrl,
        liveUrl,
        featured,
        date: Timestamp.now(),
        details,
        involvement,
        involvementDescription,
        images: galleryWithUrls,
      };
      
      console.log('Saving to Firestore...', projectData);
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('Project saved with ID:', docRef.id);
      
      // Clear cache to ensure fresh data is loaded
      cacheUtils.clearCache(cacheUtils.keys.PROJECTS);
      
      setSuccess('Project added successfully!');
      
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('tech');
      setTechnologies('');
      setServices('');
      setClient('');
      setYear('2024');
      setAccentColor('#111111');
      setMainImage(null);
      setMainImageUrl('');
      setLogoImage(null);
      setLogoUrl('');
      setGithubUrl('');
      setLiveUrl('');
      setFeatured(false);
      setGallery([]);
      setDetails({ challenge: '', solution: '', results: '' });
      setInvolvement('');
      setInvolvementDescription('');
      
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError('Error adding project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="form-title">Admin Panel</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: '#888' }}>
            Logged in as: {currentUser?.email}
          </span>
          <button onClick={handleLogout} className="theme-toggle">
            Logout
          </button>
        </div>
      </div>

      {/* Skills Admin */}
      <div style={{ margin: '2rem 0', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
        <SkillsAdmin />
      </div>

      {/* Dummy Data Uploader */}
      <DummyDataUploader />

      {/* Project List Editor */}
      <div style={{ margin: '3rem 0', borderTop: '1px solid #333', paddingTop: '2rem' }}>
        <ProjectListEditor />
      </div>

      <div style={{ margin: '3rem 0', borderTop: '1px solid #333', paddingTop: '2rem' }}>
        <h2 className="form-title">Add New Project</h2>
        <form className="form-container" onSubmit={handleSubmit} style={{ maxWidth: 700, margin: '0 auto' }}>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 12 }}>{success}</div>}
        
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} required />
        </div>
        
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="tech">Tech</option>
            <option value="media">Media</option>
          </select>
        </div>
        
        <div className="form-group">
          <label className="form-label">Technologies (comma separated)</label>
          <input className="form-input" value={technologies} onChange={e => setTechnologies(e.target.value)} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Services (comma separated)</label>
          <input className="form-input" value={services} onChange={e => setServices(e.target.value)} placeholder="App Development, Communication APIs, Web Development, etc." />
        </div>
        
        <div className="form-group">
          <label className="form-label">Client</label>
          <input className="form-input" value={client} onChange={e => setClient(e.target.value)} placeholder="Client name" />
        </div>
        
        <div className="form-group">
          <label className="form-label">Year</label>
          <input className="form-input" type="number" value={year} onChange={e => setYear(e.target.value)} min="2000" max="2030" />
        </div>
        
        <div className="form-group">
          <label className="form-label">Accent Color</label>
          <input className="color-picker" type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} />
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
            </div>
          )}
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Logo will appear next to the project title on the home page</p>
        </div>
        
        <div className="form-group">
          <label className="form-label">Main Image</label>
          <input type="file" accept="image/*" onChange={handleMainImageChange} />
          {mainImageUrl && <img src={mainImageUrl} alt="Main preview" style={{ width: 120, marginTop: 8, borderRadius: 6 }} />}
        </div>
        
        <div className="form-group">
          <label className="form-label">GitHub URL</label>
          <input className="form-input" value={githubUrl} onChange={e => setGithubUrl(e.target.value)} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Live URL</label>
          <input className="form-input" value={liveUrl} onChange={e => setLiveUrl(e.target.value)} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Featured</label>
          <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Challenge</label>
          <textarea className="form-textarea" value={details.challenge} onChange={e => setDetails(d => ({ ...d, challenge: e.target.value }))} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Solution</label>
          <textarea className="form-textarea" value={details.solution} onChange={e => setDetails(d => ({ ...d, solution: e.target.value }))} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Results</label>
          <textarea className="form-textarea" value={details.results} onChange={e => setDetails(d => ({ ...d, results: e.target.value }))} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Involvement Title</label>
          <input className="form-input" value={involvement} onChange={e => setInvolvement(e.target.value)} placeholder="e.g., Lead Developer, Technical Lead" />
        </div>
        
        <div className="form-group">
          <label className="form-label">Involvement Description</label>
          <textarea className="form-textarea" value={involvementDescription} onChange={e => setInvolvementDescription(e.target.value)} placeholder="Describe your role and contributions to this project..." />
        </div>
        
        <div className="form-group">
          <label className="form-label">Gallery Images (Multiple)</label>
          <input type="file" accept="image/*" multiple onChange={handleGalleryChange} />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Select multiple images for the project gallery</p>
          
          {gallery.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
              {gallery.map((img, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, border: '1px solid #333', borderRadius: 6, padding: 8 }}>
                  {img.preview && <img src={img.preview} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} alt={`Gallery ${idx+1}`} />}
                  <div style={{ flex: 1 }}>
                    <input className="form-input" placeholder="Title" value={img.title} onChange={e => handleGalleryMetaChange(idx, 'title', e.target.value)} style={{ marginBottom: 4 }} />
                    <input className="form-input" placeholder="Caption" value={img.caption} onChange={e => handleGalleryMetaChange(idx, 'caption', e.target.value)} style={{ marginBottom: 4 }} />
                    <select className="form-select" value={img.type} onChange={e => handleGalleryMetaChange(idx, 'type', e.target.value)} style={{ marginBottom: 4 }}>
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                    </select>
                    <div style={{ fontSize: 12, color: '#888' }}>Dimensions: {img.dimensions}</div>
                  </div>
                  <button type="button" className="theme-toggle" onClick={() => handleRemoveGalleryImage(idx)} style={{ height: 32 }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <button className="form-button" type="submit" disabled={submitting} style={{ marginTop: 24 }}>
          {submitting ? 'Submitting...' : 'Add Project'}
        </button>
      </form>
      </div>
    </div>
  );
};

export default ProjectAdminForm; 