import { Keyboard } from 'lucide-react';
import { Kbd, Modal } from './Modal.jsx';

export const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], label: 'Command palette: search anything, run any action' },
  { keys: ['1', '–', '6'], label: 'Jump to phase' },
  { keys: ['N'], label: 'Write a quick note' },
  { keys: ['T'], label: 'Toggle timeline, IOC & Splunk panel' },
  { keys: ['C'], label: 'New incident' },
  { keys: ['I'], label: 'Import a Splunk alert' },
  { keys: ['?'], label: 'Show this list' },
  { keys: ['Esc'], label: 'Close dialogs and panels' },
];

export function ShortcutsModal({ onClose }) {
  return (
    <Modal title="Keyboard shortcuts" subtitle="Work the incident without leaving the keyboard." icon={Keyboard} onClose={onClose}>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between px-4 py-2.5 text-[13px] text-ink-2">
            {s.label}
            <span className="flex items-center gap-1">
              {s.keys.map((k, i) => (k === '–' ? <span key={i} className="text-ink-4">–</span> : <Kbd key={i}>{k}</Kbd>))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
