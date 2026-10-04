// Adapter for the original, precompiled mathematics review page.
export async function loadReviewDay(request) {
  const response = await request('/api/review/today');
  if (!response.ok) throw new Error('暂时无法读取复习安排');
  const day = await response.json();
  const due = [...new Set((day.due || [])
    .map(card => Number(typeof card === 'object' && card !== null ? card.id : card))
    .filter(id => Number.isSafeInteger(id) && id > 0))];
  return { ...day, due, scheduled: Number(day.scheduled) || 0 };
}

export function getVerifiedChoice(solution) {
  if (solution?.verified !== true) return null;
  const answer = String(solution.answer || solution.final_answer || '').trim();
  return /^[A-D]$/i.test(answer) ? answer.toUpperCase() : null;
}

export async function submitMathReview(request, questionId, remembered) {
  const response = await request('/api/review/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, rating: remembered ? 'good' : 'again' })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || '复习未保存，请稍后再试');
  return result;
}
