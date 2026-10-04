import React, { useEffect, useState } from 'react';
export const WishPoolPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]), [title, setTitle] = useState(''), [content, setContent] = useState(''), [message, setMessage] = useState('');
  const load = () => fetch('/api/feedback/board').then(r => r.json()).then(r => setItems(r.items || []));
  useEffect(() => { load(); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/feedback/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, tag: '政治建议', subject: 'politics' }) });
    if (r.ok) { setTitle(''); setContent(''); setMessage('已保存到个人反馈记录'); load(); } else setMessage('保存失败，请稍后重试');
  }
  return <div className="pb-page"><h1>反馈记录</h1><p className="pb-block-sub">与数学共用个人反馈记录。记录题目勘误和改进建议，方便后续整理。</p>
    <form onSubmit={submit} className="pb-card"><label>标题<input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} required /></label><label>说明<textarea value={content} maxLength={3000} onChange={e => setContent(e.target.value)} required /></label><button className="pb-submit">保存反馈</button><p role="status">{message}</p></form>
    {items.map(i => <article className="pb-card" key={i.id}><h3>{i.title}</h3><p>{i.content}</p><small>{i.tag}</small></article>)}
  </div>;
};
