import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function StyledSelect({ options, value, onChange, placeholder = 'Select...' }) {
  // options: [{ value: 'x', label: 'X' }] or ['x', 'y', 'z']
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
        className={`w-full flex items-center justify-between px-4 py-3 border-2 rounded-xl text-sm transition-colors bg-white text-left ${open ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'}`}>
        <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-400'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {normalized.map((o, i) => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                o.value === value ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
              } ${i === 0 ? 'rounded-t-xl' : ''} ${i === normalized.length - 1 ? 'rounded-b-xl' : ''}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
