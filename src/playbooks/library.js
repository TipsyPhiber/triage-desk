// The scenario playbook library: every src/playbooks/library/*.json file is
// one category, bundled at build time. Content rules live in
// validateLibrary.js (enforced by tests/library.test.js).

// import.meta.glob is resolved by Vite (app and tests). Plain Node scripts
// that only need the built-ins (demo workspace, marketing assets) get an
// empty library instead of a crash.
let files = {};
try {
  files = import.meta.glob('./library/*.json', { eager: true, import: 'default' });
} catch {
  files = {};
}

export const LIBRARY_CATEGORIES = [];
export const LIBRARY_PLAYBOOKS = [];

for (const path of Object.keys(files).sort()) {
  const { category, playbooks } = files[path];
  LIBRARY_CATEGORIES.push({ ...category, count: playbooks.length });
  for (const p of playbooks) {
    LIBRARY_PLAYBOOKS.push({
      id: p.id,
      name: p.name,
      description: p.summary,
      tier: 'pro',
      builtIn: true,
      library: true,
      category: category.id,
      categoryName: category.name,
      tags: p.tags,
      attack: p.attack,
      severity: p.severity,
      tasks: p.tasks,
      splunk: p.splunk,
    });
  }
}

LIBRARY_CATEGORIES.sort((a, b) => a.name.localeCompare(b.name));
