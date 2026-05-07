export const EVENT_STYLES = {
  declare:  { dot: 'bg-rose-500',    label: 'DECLARE'  },
  resolve:  { dot: 'bg-emerald-500', label: 'RESOLVE'  },
  severity: { dot: 'bg-amber-500',   label: 'SEVERITY' },
  phase:    { dot: 'bg-sky-500',     label: 'PHASE'    },
  check:    { dot: 'bg-emerald-400', label: 'CHECK'    },
  uncheck:  { dot: 'bg-slate-500',   label: 'UNCHECK'  },
  ioc:      { dot: 'bg-fuchsia-500', label: 'IOC'      },
  note:     { dot: 'bg-indigo-400',  label: 'NOTE'     },
};

export const IOC_KIND_STYLES = {
  IPv4:   'border-sky-500/40 bg-sky-500/10 text-sky-300',
  Domain: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  URL:    'border-violet-500/40 bg-violet-500/10 text-violet-300',
  Email:  'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  MD5:    'border-amber-500/40 bg-amber-500/10 text-amber-300',
  SHA1:   'border-amber-500/40 bg-amber-500/10 text-amber-300',
  SHA256: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  CVE:    'border-rose-500/40 bg-rose-500/10 text-rose-300',
};
