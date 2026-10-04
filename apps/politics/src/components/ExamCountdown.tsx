import React from 'react';

function getExamDate(year: number): Date {
  // 考研初试通常在 12 月倒数第一或倒数第二个周末（周六）
  const firstDayDec = new Date(year, 11, 1);
  const dayOfWeek = firstDayDec.getDay(); // 0(Sun) - 6(Sat)
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturday = 1 + daysUntilSaturday;
  // 第三或第四个周六（通常在 12月20日前后）
  return new Date(year, 11, firstSaturday + 14);
}

function calculateCountdown(now = new Date()): { days: number; examYear: number; dateString: string } {
  const currentYear = now.getFullYear();
  let examTarget = getExamDate(currentYear);

  if (now.getTime() > examTarget.getTime()) {
    examTarget = getExamDate(currentYear + 1);
  }

  const diffTime = examTarget.getTime() - now.getTime();
  const days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  const examYear = examTarget.getFullYear() + 1; // 如 2025年底考研对应 2026 届
  const dateString = `${examTarget.getFullYear()} 年 ${examTarget.getMonth() + 1} 月 ${examTarget.getDate()} 日`;

  return { days, examYear, dateString };
}

export const ExamCountdown: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { days, examYear, dateString } = calculateCountdown();

  return (
    <p className={`exam-countdown ${className}`.trim()} title="按往年时间估算的学习目标，实际考试日期请以官方公告为准">
      距 <b>{examYear}</b> 备考目标约 <b className="ec-days">{days}</b> 天
      <span className="ec-date"> · 预计 {dateString}</span>
    </p>
  );
};
