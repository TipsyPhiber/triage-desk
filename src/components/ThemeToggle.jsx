import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getThemePref, setThemePref } from '../lib/theme.js';

const OPTIONS = [
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'dark', icon: Moon, label: 'Dark' },
  { id: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle({ className = '' }) {
  const [pref, setPref] = useState(getThemePref);
  return (
    <div role="radiogroup" aria-label="Appearance" className={`inline-flex items-center rounded-lg border border-line bg-raised p-0.5 ${className}`}>
      {OPTIONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          role="radio"
          aria-checked={pref === id}
          title={`${label} theme`}
          aria-label={`${label} theme`}
          onClick={() => { setThemePref(id); setPref(id); }}
          className={`w-7 h-6 flex items-center justify-center rounded-md transition ${pref === id ? 'bg-surface text-ink shadow-card ring-1 ring-line-2' : 'text-ink-3 hover:text-ink'}`}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}

// Cycle light → dark → system, for the command palette and shortcuts.
export function cycleTheme() {
  const order = OPTIONS.map((o) => o.id);
  const next = order[(order.indexOf(getThemePref()) + 1) % order.length];
  setThemePref(next);
  return next;
}
