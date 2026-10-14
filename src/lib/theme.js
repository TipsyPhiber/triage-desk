// Per-viewer appearance: 'light' | 'dark' | 'system'. Stored in this
// browser only (not in the workspace or backups). Always resolves to a
// concrete data-theme on <html> so Tailwind's dark: variant works.

const KEY = 'triage-desk-theme';
export const THEMES = ['light', 'dark', 'system'];

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.includes(v) ? v : 'light';
  } catch {
    return 'light';
  }
}

function systemDark() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref) {
  return pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref;
}

export function applyTheme(pref = getThemePref()) {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref); } catch { /* per-viewer convenience only */ }
  applyTheme(pref);
}

// Follow the OS while the preference is 'system'.
export function watchSystemTheme() {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const on = () => { if (getThemePref() === 'system') applyTheme('system'); };
  mq.addEventListener?.('change', on);
  return () => mq.removeEventListener?.('change', on);
}
