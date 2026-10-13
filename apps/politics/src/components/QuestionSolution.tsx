import React, {useMemo} from 'react';
import type {QuestionFigure, QuestionSource} from '../types/politics';

export const QuestionIllustration: React.FC<{figure?: QuestionFigure}> = ({figure}) => {
  if (!figure) return null;
  return <figure className="pb-question-figure">
    <svg role="img" aria-label={figure.alt} viewBox={figure.viewBox}>
      <title>{figure.alt}</title>
      <image href={figure.src} width={figure.width} height={figure.height} />
    </svg>
  </figure>;
};

export const QuestionSources: React.FC<{sources?: QuestionSource[]}> = ({sources}) => {
  const links = sources?.filter(source => /^https:\/\//.test(source.url));
  if (!links?.length) return null;
  return <div className="pb-question-sources">题目与参考答案来源：{links.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>)}</div>;
};

export const AnalysisSection: React.FC<{text: string}> = ({text}) => {
  const sections = useMemo(() => {
    const items: Array<{title: string | null; body: string}> = [];
    const regex = /【([^】]{1,12})】/g;
    let offset = 0, title: string | null = null, match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const body = text.slice(offset, match.index).trim();
      if (body || title) items.push({title, body});
      title = match[1]; offset = match.index + match[0].length;
    }
    const body = text.slice(offset).trim();
    if (body || title) items.push({title, body});
    return items.length ? items : [{title: null, body: text}];
  }, [text]);
  return <div className="pb-analysis">{sections.map((section, index) => <div className="pb-sec" key={index}>
    {section.title && <div className="pb-sec-title">【{section.title}】</div>}
    {section.body.split('\n').filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
  </div>)}</div>;
};
