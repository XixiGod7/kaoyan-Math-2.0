import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { KaoyanDict, DictEntry, LexiconManifest } from '../types/kaoyan';
import { VocabStatItem } from '../types/reading';
import { IRREGULAR_VERBS, getLemmas } from '../utils/vocabLemmatizer';
import { normalizeWord, hasWord } from '../../../../public/shared/lexicon.mjs';
export { normalizeWord };

// Sources contain both bare IPA and /IPA/; render one consistent delimiter pair.
export function formatPhonetic(phonetic?: string) {
  const value = (phonetic || '').trim().replace(/^\/+|\/+$/g, '').trim();
  return value ? `/${value}/` : '';
}

export type DictionaryStatus = 'idle' | 'loading' | 'ready' | 'error';
type Frequency = { version: number; total: number; items: Record<string, Omit<VocabStatItem, 'byYear'> & { byYear: Record<string, number> }> };
type Package = { dict: KaoyanDict; frequency: Frequency; manifest: LexiconManifest };
export interface DictionaryState {
  status: DictionaryStatus; dict: KaoyanDict | null; frequency: Frequency | null;
  manifest: LexiconManifest | null; error: string | null; offline: boolean;
}
export interface LookupResult {
  found: boolean; rawWord: string; wordKey: string; matchType: 'exact' | 'inflection' | 'none';
  entry: DictEntry | null; missingReason?: 'not_found' | 'loading' | 'error';
}
let state: DictionaryState = { status: 'idle', dict: null, frequency: null, manifest: null, error: null, offline: false };
let inFlightPromise: Promise<KaoyanDict> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());
const IDB_NAME = 'kaoyan-public-lexicon-cache', IDB_STORE = 'lexicon', IDB_KEY = 'v2_package';

// A denied/blocked cache must never prevent network loading or retry.
function cachedPackage(value?: Package): Promise<Package | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    let db: IDBDatabase | undefined, done = false;
    const finish = (result: Package | null) => { if (done) return; done = true; clearTimeout(timer); db?.close(); resolve(result); };
    const timer = setTimeout(() => finish(null), 4000);
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(IDB_STORE)) request.result.createObjectStore(IDB_STORE); };
      request.onerror = request.onblocked = () => finish(null);
      request.onsuccess = () => {
        db = request.result;
        if (done) { db.close(); return; }
        try {
          const tx = db.transaction(IDB_STORE, value ? 'readwrite' : 'readonly');
          let result: Package | null = null;
          const item = value ? tx.objectStore(IDB_STORE).put(value, IDB_KEY) : tx.objectStore(IDB_STORE).get(IDB_KEY);
          if (!value) item.onsuccess = () => { result = item.result || null; };
          tx.oncomplete = () => finish(value || result);
          tx.onerror = tx.onabort = () => finish(null);
        } catch { finish(null); }
      };
    } catch { finish(null); }
  });
}
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
  .map(n => n.toString(16).padStart(2, '0')).join('').slice(0, 12);
function validManifest(m: LexiconManifest) {
  if (m?.version !== 2) throw Error('词库版本无效');
  for (const [name, info] of [['lexicon', m.lexicon], ['vocab-frequency', m.frequency]] as const) {
    if (!info || !/^[a-f0-9]{12}$/.test(info.hash) || info.hashedPath !== `/english-data/${name}.${info.hash}.json`) throw Error('词库资源清单无效');
  }
}
function validatePackage(p: Package) {
  validManifest(p.manifest);
  if (p.dict?.version !== 2 || !p.dict.entries || Array.isArray(p.dict.entries)
    || Object.keys(p.dict.entries).length !== p.manifest.lexicon.entriesCount
    || p.frequency?.version !== 2 || !p.frequency.items || Array.isArray(p.frequency.items)
    || Object.keys(p.frequency.items).length !== p.manifest.frequency.itemsCount) throw Error('词库内容与清单不一致');
  for (const [word, entry] of Object.entries(p.dict.entries)) {
    if (!hasWord(p.dict.entries, word) || normalizeWord(word) !== word || typeof entry?.definition_cn !== 'string' || !entry.definition_cn.trim()
      || (entry.supplementary_cn != null && (!Array.isArray(entry.supplementary_cn) || entry.supplementary_cn.some(s => typeof s !== 'string')))) throw Error('词条内容无效');
  }
  for (const [word, item] of Object.entries(p.frequency.items)) {
    if (!hasWord(p.dict.entries, word) || item.w !== word || !Number.isFinite(item.n) || !Number.isFinite(item.rank)) throw Error('词频关联无效');
  }
}
async function loadAsset<T>(path: string, hash: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw Error(`词典资源加载失败 (${response.status})`);
  const body = await response.text();
  if (await digest(body) !== hash) throw Error('词库资源版本校验失败，请重试');
  return JSON.parse(body);
}

export async function loadDictionary(forceReload = false): Promise<KaoyanDict> {
  // Retry joins an existing request too; an older request cannot overwrite a newer result.
  if (inFlightPromise) return inFlightPromise;
  if (!forceReload && state.status === 'ready' && state.dict) return state.dict;
  state = { ...state, status: 'loading', error: null };
  const task = (async () => {
    try {
      const response = await fetch('/english-data/lexicon-manifest.json', { cache: 'no-cache' });
      if (!response.ok) throw Error(`词库清单加载失败 (${response.status})`);
      const manifest: LexiconManifest = await response.json();
      validManifest(manifest);
      const [dict, frequency] = await Promise.all([
        loadAsset<KaoyanDict>(manifest.lexicon.hashedPath, manifest.lexicon.hash),
        loadAsset<Frequency>(manifest.frequency.hashedPath, manifest.frequency.hash),
      ]);
      const pack = { manifest, dict, frequency };
      validatePackage(pack);
      state = { ...pack, status: 'ready', error: null, offline: false };
      void cachedPackage(pack);
      return dict;
    } catch (error) {
      const pack = await cachedPackage();
      if (pack) {
        try {
          validatePackage(pack);
          if (await digest(JSON.stringify(pack.dict)) !== pack.manifest.lexicon.hash
            || await digest(JSON.stringify(pack.frequency)) !== pack.manifest.frequency.hash) throw Error('本地词库版本无效');
          state = { ...pack, status: 'ready', error: null, offline: true };
          return pack.dict;
        } catch { /* Invalid public cache must not become a ready dictionary. */ }
      }
      const message = error instanceof Error ? error.message : '词典载入失败，请重试';
      state = { ...state, status: 'error', error: message };
      throw Error(message);
    }
  })();
  inFlightPromise = task;
  notify();
  try { return await task; }
  finally { inFlightPromise = null; notify(); }
}

export function resolveLemma(rawWord: string, entries: Record<string, DictEntry>): { lemma: string; entry: DictEntry } | null {
  const word = normalizeWord(rawWord);
  if (hasWord(entries, word)) return { lemma: word, entry: entries[word] };
  if (Object.hasOwn(IRREGULAR_VERBS, word) && hasWord(entries, IRREGULAR_VERBS[word])) return { lemma: IRREGULAR_VERBS[word], entry: entries[IRREGULAR_VERBS[word]] };
  // Reuse the coverage analyser's candidates, but never silently choose an ambiguous root.
  const candidates = getLemmas(word).filter(w => hasWord(entries, w));
  return candidates.length === 1 ? { lemma: candidates[0], entry: entries[candidates[0]] } : null;
}
export function lookup(rawWord: string, customDict?: KaoyanDict | null): LookupResult {
  const dict = customDict || state.dict, word = normalizeWord(rawWord);
  const result = dict ? resolveLemma(rawWord, dict.entries) : null;
  return result ? { found: true, rawWord, wordKey: result.lemma, entry: result.entry, matchType: word === result.lemma ? 'exact' : 'inflection' }
    : { found: false, rawWord, wordKey: word, entry: null, matchType: 'none', missingReason: !dict && state.status === 'loading' ? 'loading' : !dict && state.status === 'error' ? 'error' : 'not_found' };
}
export function getDefinition(word: string, customDict?: KaoyanDict | null) {
  const result = lookup(word, customDict);
  return { main: result.entry?.definition_cn || (result.missingReason === 'loading' ? '词典加载中…' : result.missingReason === 'error' ? '词典加载失败，请重试' : '暂无释义'),
    supplementary: result.entry?.supplementary_cn || [], phonetic: result.entry?.phonetic || '' };
}
export function searchDictionary(query: string, customDict?: KaoyanDict | null, limit = 50) {
  const dict = customDict || state.dict, q = query.trim().toLowerCase();
  if (!dict || !q || limit < 1) return [];
  return Object.entries(dict.entries).flatMap(([word, entry]) => {
    const definitions = [entry.definition_cn, ...(entry.supplementary_cn || [])].join(' ').toLowerCase();
    const score = word === q ? 100 : word.startsWith(q) ? 80 : word.includes(q) ? 60 : definitions.includes(q) ? 40 : 0;
    return score ? [{ word, entry, score }] : [];
  }).sort((a, b) => b.score - a.score || a.word.localeCompare(b.word)).slice(0, limit);
}
export function subscribeDictionary(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getDictionaryState() { return state; }
export function useDictionary() {
  const current = useSyncExternalStore(subscribeDictionary, getDictionaryState);
  useEffect(() => {
    if (current.status !== 'idle') return;
    const timer = setTimeout(() => { void loadDictionary().catch(() => {}); }, 100);
    return () => clearTimeout(timer);
  }, [current.status]);
  const vocabulary = useMemo<VocabStatItem[]>(() => current.dict && current.frequency
    ? Object.entries(current.frequency.items).map(([word, item]) => ({ ...item, byYear: JSON.stringify(item.byYear), trans: current.dict!.entries[word].definition_cn, phonetic: current.dict!.entries[word].phonetic }))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)) : [], [current.dict, current.frequency]);
  return { ...current, vocabulary, loading: current.status === 'idle' || current.status === 'loading', isReady: current.status === 'ready',
    reload: () => loadDictionary(true), lookup: (word: string) => lookup(word, current.dict), getDefinition: (word: string) => getDefinition(word, current.dict) };
}
