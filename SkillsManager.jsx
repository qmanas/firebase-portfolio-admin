import React, { useState } from 'react';
import useSkillsViewModel from '../viewmodels/useSkillsViewModel';
import useHomeViewModel from '../viewmodels/useHomeViewModel';
import { analyzeSkillsFromProjects } from '../utils/skillsAnalyzer';

const emptySkill = { name: '', rank: 999, iconUrl: '', active: true };

const SkillsAdmin = () => {
  const { skills, loading, error, addSkill, updateSkill, deleteSkill, uploadIcon, refetch } = useSkillsViewModel();
  const { projects } = useHomeViewModel();
  const [form, setForm] = useState(emptySkill);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addSkill({
        name: form.name.trim(),
        rank: Number(form.rank) || 999,
        iconUrl: form.iconUrl,
        active: !!form.active,
        updatedAt: new Date().toISOString(),
      });
      setForm(emptySkill);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadIcon = async (file) => {
    if (!file) return;
    const url = await uploadIcon(file, form.name || file.name);
    setForm(prev => ({ ...prev, iconUrl: url }));
  };

  return (
    <div>
      <h2 className="form-title">Technologies Admin</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: -8 }}>
        Manage hero technologies: set rank, toggle active, and add icon URLs. These are preferred on the homepage over computed skills.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '0.75rem 0 1.25rem' }}>
        <button
          className="theme-toggle"
          disabled={importing}
          onClick={async () => {
            try {
              setImporting(true);
              const analysis = analyzeSkillsFromProjects(projects);
              // Seed ALL missing technologies with default rank and no icon
              const all = analysis;
              for (let i = 0; i < all.length; i++) {
                const tech = all[i].name;
                // Skip if already present (case-insensitive match)
                const exists = skills.some(s => (s.name || '').toLowerCase() === tech.toLowerCase());
                if (exists) continue;
                await addSkill({ name: tech, rank: i + 1, iconUrl: '', active: true, createdAt: new Date().toISOString() });
              }
              await refetch();
            } finally {
              setImporting(false);
            }
          }}
        >
          {importing ? 'Importing…' : 'Import All Technologies from Projects'}
        </button>
      </div>

      <form className="form-container" onSubmit={handleSubmit} style={{ maxWidth: 700, margin: '1rem 0 2rem' }}>
        <div className="form-group">
          <label className="form-label">Skill Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label className="form-label">Rank (lower shows first)</label>
          <input className="form-input" type="number" value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Icon URL</label>
          <input className="form-input" value={form.iconUrl} onChange={e => setForm(f => ({ ...f, iconUrl: e.target.value }))} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label className="form-label">Upload Icon</label>
          <input type="file" accept="image/*" onChange={e => handleUploadIcon(e.target.files?.[0])} />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Recommended: small square PNG/SVG.</p>
          {form.iconUrl && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={form.iconUrl} alt="icon preview" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <a href={form.iconUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-secondary)' }}>Open</a>
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Active</label>
          <input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
        </div>
        <button className="form-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Skill'}</button>
      </form>

      <div style={{ borderTop: '1px solid #333', paddingTop: '1rem' }}>
        <h3 className="form-title" style={{ fontSize: '1.2rem' }}>Existing Technologies</h3>
        {loading && <div style={{ color: '#888' }}>Loading skills...</div>}
        {error && <div style={{ color: '#e74c3c' }}>{error}</div>}
        {skills && skills.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {skills.map(skill => (
              <div key={skill.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto auto', gap: 12, alignItems: 'center', border: '1px solid #333', borderRadius: 8, padding: 12 }}>
                <div>
                  {skill.iconUrl ? (
                    <img src={skill.iconUrl} alt="icon" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--color-bg-secondary)', border: '1px solid #444' }} />
                  )}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{skill.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Rank: {skill.rank} • {skill.active === false ? 'Inactive' : 'Active'}</div>
                </div>
                <button className="theme-toggle" onClick={async () => { await updateSkill(skill.id, { active: !(skill.active !== false) }); }}>
                  {skill.active === false ? 'Activate' : 'Deactivate'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="theme-toggle" onClick={async () => { const nr = Number(window.prompt('New rank', String(skill.rank ?? 999))); if (!Number.isNaN(nr)) await updateSkill(skill.id, { rank: nr }); }}>Edit Rank</button>
                  <button className="theme-toggle" onClick={async () => { const url = window.prompt('New icon URL', skill.iconUrl || ''); if (url !== null) await updateSkill(skill.id, { iconUrl: url }); }}>Icon URL</button>
                  <button className="theme-toggle" onClick={async () => { if (window.confirm('Delete this skill?')) await deleteSkill(skill.id); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-secondary)' }}>No technologies yet.</div>
        )}
      </div>
    </div>
  );
};

export default SkillsAdmin;
