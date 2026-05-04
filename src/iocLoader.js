let pending = null;

export function loadIocExtractor() {
  if (!pending) {
    pending = import('./wasm/ioc-extractor/ioc_extractor.js').then(async (mod) => {
      await mod.default();
      return mod;
    });
  }
  return pending;
}
