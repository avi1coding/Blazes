import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function DarkSelect({ options, value, onChange, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const normalized = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const selected = normalized.find(o => o.value === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl text-sm transition-colors text-left ${
          open ? 'bg-white/15 border-purple-400' : 'bg-white/10 border-white/20 hover:border-white/40'
        }`}>
        <span className={selected ? 'text-white font-bold' : 'text-white/40'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-purple-950 border border-white/20 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {normalized.map((o, i) => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                o.value === value ? 'bg-purple-600/40 text-white font-bold' : 'text-white/80 hover:bg-white/10'
              } ${i === 0 ? 'rounded-t-xl' : ''} ${i === normalized.length - 1 ? 'rounded-b-xl' : ''}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
