import { useState, useEffect, useRef, useCallback } from 'react';
import { ImagePlus, Link as LinkIcon, Search, UploadCloud, X, Clipboard } from 'lucide-react';

/**
 * Unified image input. Supports five ways to add an image:
 *  1. Paste a URL                  — text field
 *  2. Upload a file                — file picker button
 *  3. Drag & drop                  — anywhere on the drop zone
 *  4. Clipboard paste (Cmd/Ctrl+V) — auto-handled when the picker is focused
 *  5. Search Google Images         — button opens a new tab; user copies the
 *                                    URL back into the picker (Google blocks
 *                                    embedding their image search, so opening
 *                                    in a new tab is the only legitimate option)
 *
 * Props:
 *   value         — current image URL (string, '' when empty)
 *   onChange      — called with new URL whenever the user picks/uploads
 *   searchQuery   — optional; pre-fills the Google Images search
 *   uploadEndpoint — defaults to /api/upload-image; pass null to skip the
 *                    server upload and use a base64 data URL instead.
 *   accept        — defaults to 'image/*'
 *   onError       — optional toast/error callback
 *   compact       — when true, renders a single-row layout (used inline)
 */
const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export default function ImagePicker({
  value = '',
  onChange,
  searchQuery = '',
  uploadEndpoint = `${BASE}/api/upload-image`,
  accept = 'image/*',
  onError,
  compact = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);

  const resolveUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    return `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('Only image files are allowed.');
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      if (uploadEndpoint) {
        try {
          const res = await fetch(uploadEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: dataUrl }),
          });
          const data = await res.json();
          onChange?.(data.url || dataUrl);
        } catch {
          // Server upload failed → fall back to inline data URL so the user
          // can still proceed; the parent can decide how to handle it.
          onChange?.(dataUrl);
        }
      } else {
        onChange?.(dataUrl);
      }
    } catch (e) {
      onError?.(e.message || 'Failed to load image');
    } finally {
      setUploading(false);
    }
  }, [onChange, onError, uploadEndpoint]);

  // Clipboard paste — only fires when the picker has been "engaged" (clicked
  // into / focused). Avoids hijacking pastes elsewhere on the page.
  useEffect(() => {
    if (!focused) return;
    const handler = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            return;
          }
        }
      }
      // Plain text paste — if it looks like a URL, use it directly so a quick
      // "right-click → copy image address → paste" works in this picker too.
      const text = e.clipboardData?.getData('text/plain');
      if (text && /^https?:\/\//i.test(text.trim())) {
        e.preventDefault();
        onChange?.(text.trim());
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [focused, handleFile, onChange]);

  // Click-away unfocuses so the global paste handler unbinds.
  useEffect(() => {
    if (!focused) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [focused]);

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const openGoogleImages = () => {
    const q = encodeURIComponent((searchQuery || '').trim() || 'free stock image');
    window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={containerRef}
      onClick={() => setFocused(true)}
      onFocus={() => setFocused(true)}
      tabIndex={-1}
      className={`${compact ? '' : 'space-y-2'}`}
    >
      {/* Preview */}
      {value && (
        <div className="relative mb-2">
          <img
            src={resolveUrl(value)}
            alt="Preview"
            className="w-full max-h-44 object-contain rounded-xl bg-gray-50 border border-gray-200 p-2"
          />
          <button
            type="button"
            onClick={() => onChange?.('')}
            className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-sm hover:bg-black/80 transition-colors"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Drop zone — only when no image yet, to keep the UI compact */}
      {!value && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors ${
            dragOver
              ? 'border-red-400 bg-red-50/70'
              : focused
                ? 'border-red-300 bg-red-50/40'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <UploadCloud className={`w-7 h-7 mx-auto mb-1.5 ${dragOver ? 'text-red-500' : 'text-gray-400'}`} strokeWidth={2} />
          <div className="text-sm font-bold text-gray-700">
            Drag & drop, or paste an image
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1">
            <Clipboard className="w-3 h-3" /> Cmd/Ctrl + V works here too
          </div>
        </div>
      )}

      {/* URL field */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2.5} />
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="Paste an image URL"
            className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-red-500 focus:outline-none transition-colors"
          />
        </div>
        <label className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors border-2 ${
          uploading
            ? 'bg-gray-100 text-gray-400 border-gray-200'
            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
        }`}>
          <ImagePlus className="w-4 h-4" />
          <span className="hidden sm:inline">{uploading ? 'Uploading…' : 'Upload'}</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
        <button
          type="button"
          onClick={openGoogleImages}
          title="Search Google Images"
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold border-2 bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Google</span>
        </button>
      </div>
    </div>
  );
}
