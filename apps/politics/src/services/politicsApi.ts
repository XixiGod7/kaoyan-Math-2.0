import type { BankDetail, BankSummary, Chapter, PaperHistoryItem, PaperSubmitResult, Question, Stats, UserAnswerRecord } from '../types/politics';
export const L = ['A', 'B', 'C', 'D'] as const;
export const S = ['马原', '毛中特', '新思想', '史纲', '思修', '时政'] as const;
export const normalizeChoices = (value: string | Iterable<string>) => [...new Set(typeof value === 'string' ? value.toUpperCase() : [...value])].filter(c => 'ABCD'.includes(c)).sort().join('');
export const pe = normalizeChoices;
async function api<T>(url: string, data?: unknown, key?: string): Promise<T> {
  try {
  const res = await fetch('/api/politics' + url, data === undefined ? {} : { method: 'POST', keepalive: url === '/note', headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(data) });
  const body = await res.json();
  if (!res.ok) {
    if (data !== undefined) return { ok: false, message: body.error || '操作失败' } as T;
    throw new Error(body.error || '内容加载失败');
  }
  if (data !== undefined) window.dispatchEvent(new Event('study:update'));
  return body as T;
  } catch (e) {
    if (data !== undefined) return { ok: false, message: e instanceof Error ? e.message : '网络连接失败' } as T;
    throw e;
  }
}
export const getBanksApi = (kind?: 'book' | 'exam') => api<BankSummary[]>('/banks' + (kind ? '?kind=' + kind : ''));
export const getBankApi = (code: string) => api<BankDetail | null>('/banks/' + encodeURIComponent(code));
export const getChapterApi = (code: string) => api<Chapter | null>('/chapters/' + encodeURIComponent(code));
export const getChapterAnswersApi = (code: string) => api<UserAnswerRecord[]>('/chapters/' + encodeURIComponent(code) + '/answers');
export const submitAnswerApi = (qid: string | number, choice: string | Iterable<string>, chapterCode?: string) => api<any>('/answer', { qid, choice: normalizeChoices(choice), chapterCode });
const noteQueue = new Map<string, Promise<{ ok: boolean }>>();
export const saveUserNoteApi = (qid: string | number, note: string) => {
  const key = String(qid);
  const next = (noteQueue.get(key) || Promise.resolve({ ok: true })).then(() => api<{ ok: boolean }>('/note', { qid, note }));
  noteQueue.set(key, next);
  void next.finally(() => { if (noteQueue.get(key) === next) noteQueue.delete(key); });
  return next;
};
export const getWrongQuestionsApi = (page = 0, subject = '') => api<{ total: number; items: Question[] }>('/wrong?page=' + page + '&subject=' + encodeURIComponent(subject));
export const getFavoritesApi = (page = 0) => api<{ total: number; items: Question[] }>('/favorites?page=' + page);
export const getFavoriteIdsApi = () => api<string[]>('/favorite-ids');
export const toggleFavoriteApi = (qid: string | number, on: boolean) => api<{ ok: boolean; on: boolean }>('/favorite', { qid, on });
export const getDueReviewsApi = (limit = 20) => api<{ total: number; items: Question[] }>('/review?limit=' + limit);
export const gradeReviewApi = (qid: string | number, grade: 0 | 1 | 2) => api<{ ok: boolean; message?: string }>('/review', { qid, grade });
export const submitPaperApi = (code: string, answers: Array<{ id: string | number; choice: string }>, duration = 0, key = crypto.randomUUID()) => api<PaperSubmitResult>('/papers/' + encodeURIComponent(code) + '/submit', { answers, duration }, key);
export const getPaperHistoryApi = (code: string) => api<PaperHistoryItem[]>('/papers/' + encodeURIComponent(code) + '/history');
export const getPaperDraftApi = (code: string) => api<{ choices: Record<string, string>; elapsed: number } | null>('/papers/' + encodeURIComponent(code) + '/draft');
export const savePaperDraftApi = (code: string, choices: Record<string, string>, elapsed: number) => api<{ ok: boolean }>('/papers/' + encodeURIComponent(code) + '/draft', { choices, elapsed });
export const getStatsApi = () => api<Stats>('/stats');
export const askAiApi = (qid: string | number, question: string) => api<{ ok: boolean; answer: string; message?: string }>('/ask', { qid, question });
