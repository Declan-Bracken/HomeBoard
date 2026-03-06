import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import HoldCanvas from '../components/wall/HoldCanvas'
import { useQuery } from '@tanstack/react-query'

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .wall-root {
    min-height: 100vh; background-color: #0f0e0d;
    font-family: 'DM Sans', sans-serif; color: #f5f0eb;
  }

  .wall-root::before {
    content: ''; position: fixed; inset: 0;
    background-image:
      radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255, 100, 40, 0.06) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0;
  }

  /* NAV */
  .wall-nav {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 56px;
    background: rgba(15, 14, 13, 0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .nav-left { display: flex; align-items: center; gap: 12px; }

  .nav-back {
    background: none; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300;
    color: rgba(245, 240, 235, 0.4); cursor: pointer; transition: color 0.2s;
    padding: 0; display: flex; align-items: center; gap: 6px; min-height: 44px;
  }
  .nav-back:hover { color: #ff6428; }

  .nav-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }

  .nav-logo {
    font-family: 'Bebas Neue', sans-serif; font-size: 22px;
    letter-spacing: 0.08em; color: #f5f0eb;
  }
  .nav-logo span { color: #ff6428; }

  /* MAIN */
  .wall-main {
    position: relative; z-index: 1;
    max-width: 1100px; margin: 0 auto;
    padding: 24px 20px 60px;
  }

  /* HEADER */
  .wall-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 24px; flex-wrap: wrap;
  }

  .wall-title {
    font-family: 'Bebas Neue', sans-serif; font-size: 40px;
    line-height: 0.9; letter-spacing: 0.03em;
  }
  .wall-title span { color: #ff6428; }

  .wall-subtitle {
    font-size: 12px; font-weight: 300;
    color: rgba(245, 240, 235, 0.35); margin-top: 8px;
  }

  /* UPLOAD ZONE */
  .upload-zone {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 56px 24px;
    border: 1px dashed rgba(255,255,255,0.1); border-radius: 2px;
    background: #161412; cursor: pointer; transition: border-color 0.2s, background 0.2s;
    position: relative;
  }
  .upload-zone:hover { border-color: rgba(255, 100, 40, 0.3); background: #1a1714; }
  .upload-zone input[type="file"] {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
  }
  .upload-icon { font-size: 32px; opacity: 0.3; }
  .upload-label {
    font-family: 'Bebas Neue', sans-serif; font-size: 20px;
    letter-spacing: 0.08em; color: rgba(245, 240, 235, 0.5);
  }
  .upload-sublabel {
    font-size: 12px; font-weight: 300;
    color: rgba(245, 240, 235, 0.25); letter-spacing: 0.05em; text-align: center;
  }

  /* LOADING STATE */
  .loading-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 80px 24px;
    border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; background: #161412;
  }
  .loading-spinner {
    width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.08);
    border-top-color: #ff6428; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 13px; font-weight: 300; color: rgba(245, 240, 235, 0.4); }
  .loading-sublabel { font-size: 11px; font-weight: 300; color: rgba(245, 240, 235, 0.2); text-align: center; }

  /* ERROR */
  .error-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; background: rgba(255, 60, 60, 0.08);
    border: 1px solid rgba(255, 60, 60, 0.2); border-radius: 2px;
    font-size: 13px; font-weight: 300; color: #ff6060; margin-bottom: 20px;
  }

  /* CANVAS SECTION */
  .canvas-section { display: flex; flex-direction: column; gap: 0; }
  .canvas-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 0 12px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 16px;
    flex-wrap: wrap; gap: 8px;
  }
  .canvas-title {
    font-family: 'Bebas Neue', sans-serif; font-size: 18px;
    letter-spacing: 0.06em; color: rgba(245, 240, 235, 0.7);
  }
  .canvas-meta {
    font-size: 11px; font-weight: 300; color: rgba(245, 240, 235, 0.25);
    letter-spacing: 0.08em; text-transform: uppercase;
  }

  .reupload-btn {
    background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px;
    padding: 6px 14px; font-family: 'DM Sans', sans-serif; font-size: 12px;
    font-weight: 500; letter-spacing: 0.06em; color: rgba(245, 240, 235, 0.4);
    cursor: pointer; transition: all 0.2s; min-height: 36px;
  }
  .reupload-btn:hover { border-color: rgba(255, 100, 40, 0.3); color: #ff6428; }

  /* ── Responsive ── */
  @media (min-width: 701px) {
    .wall-nav { padding: 0 40px; height: 60px; }
    .nav-logo { font-size: 24px; }
    .wall-main { padding: 40px 40px 60px; }
    .wall-title { font-size: 48px; }
  }
`

function WallPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { data: wall } = useQuery({
    queryKey: ['wall', id],
    queryFn: async () => (await api.get(`/walls/${id}/`)).data
  })

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true); setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await api.post(`/walls/${id}/preview/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setPreview(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (finalHolds) => {
    try {
      await api.post(`/walls/${id}/confirm-holds/`, {
        holds: finalHolds,
        image_path: preview.image_path
      })
      navigate(`/walls/${id}/detail/`)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to confirm holds')
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="wall-root">
        <nav className="wall-nav">
          <div className="nav-left">
            <button className="nav-back" onClick={() => navigate('/home')}>← Back</button>
            <div className="nav-divider" />
            <div className="nav-logo">Home<span>Board</span></div>
          </div>
        </nav>

        <main className="wall-main">
          <div className="wall-header">
            <div>
              <h1 className="wall-title">{wall ? <span>{wall.name}</span> : <span>#{id}</span>}</h1>
              <p className="wall-subtitle">
                {preview
                  ? `${preview.holds.length} holds detected — review and confirm below`
                  : 'Upload a wall image to begin hold detection'}
              </p>
            </div>
            {preview && (
              <button className="reupload-btn" onClick={() => setPreview(null)}>↺ Re-upload</button>
            )}
          </div>

          {error && <div className="error-bar">⚠ {error}</div>}

          {!preview && !loading && (
            <div className="upload-zone">
              <input type="file" accept="image/*" onChange={handleUpload} />
              <div className="upload-icon">⬆</div>
              <div className="upload-label">Upload Wall Image</div>
              <div className="upload-sublabel">JPG or PNG — panoramas supported</div>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div className="loading-label">Running segmentation model...</div>
              <div className="loading-sublabel">This may take a moment for large images</div>
            </div>
          )}

          {preview && !loading && (
            <div className="canvas-section">
              <div className="canvas-header">
                <span className="canvas-title">Hold Review</span>
                <span className="canvas-meta">{preview.image_width} × {preview.image_height}px</span>
              </div>
              <HoldCanvas preview={preview} onConfirm={handleConfirm} />
            </div>
          )}
        </main>
      </div>
    </>
  )
}

export default WallPage
