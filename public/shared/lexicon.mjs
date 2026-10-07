// Shared by the browser, build scripts and both server runtimes.
export function normalizeWord(raw) {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFKC').toLowerCase().trim()
    .replace(/[‘’ʼ]/g, "'").replace(/[‐‑‒–—]/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

export function hasWord(entries, word) {
  return Boolean(word && !['__proto__', 'constructor', 'prototype'].includes(word)
    && Object.hasOwn(entries, word));
}
