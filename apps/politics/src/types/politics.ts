export type SubjectType = '马原' | '毛中特' | '新思想' | '史纲' | '思修' | '时政' | '综合';

export type QuestionType = 'single' | 'multi';

export interface QuestionChoices {
  A: string;
  B: string;
  C: string;
  D: string;
  [key: string]: string;
}

export interface Question {
  id: string | number;
  stem: string;
  choices: QuestionChoices;
  answer: string;
  type: QuestionType;
  subject: SubjectType;
  isReal?: boolean;
  analysis?: string;
  attempts?: number;
  myChoice?: string;
  userNote?: string;
  score?: number;
}

export interface Chapter {
  code: string;
  name: string;
  subject: SubjectType;
  bankCode: string;
  bankName: string;
  questions: Question[];
}

export interface BankChapterSummary {
  code: string;
  name: string;
  subject: SubjectType;
  qCount: number;
  done: number;
  correct: number;
  questions?: Question[];
}

export interface BankSummary {
  code: string;
  name: string;
  kind: 'book' | 'exam';
  qCount: number;
  done: number;
  correct: number;
  lastAt?: string;
  resumeCode?: string;
  resumeName?: string;
  aveScore?: number;
}

export interface BankDetail {
  code: string;
  name: string;
  kind: 'book' | 'exam';
  qCount: number;
  aveScore?: number;
  chapters: BankChapterSummary[];
}

export interface SubjectStat {
  subject: SubjectType;
  done: number;
  correct: number;
  multiDone: number;
  multiCorrect: number;
}

export interface Stats {
  bySubject: SubjectStat[];
  total: number;
  correct: number;
  wrong: number;
  due: number;
  favorites: number;
}

export interface UserAnswerRecord {
  id: string | number;
  chapterCode?: string;
  choice: string;
  correct: boolean;
  answer: string;
  myChoice: string;
  analysis: string;
  missed?: string;
  extra?: string;
  userNote?: string;
  timestamp: number;
  attempts?: number;
  // For spaced repetition review
  nextReviewAt?: number;
  reviewInterval?: number; // in days
  reviewRounds?: number;
}

export interface PaperSubmitResult {
  ok: boolean;
  score: number;
  full: number;
  aveScore?: number;
  detail: Array<{
    id: string | number;
    correct: boolean;
    answer: string;
    picked: string;
  }>;
  message?: string;
}

export interface PaperHistoryItem {
  score: number;
  takenAt: string;
  duration?: number;
}

export interface WishComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  isAdmin?: boolean;
}

export interface WishItem {
  id: string;
  type: 'wish' | 'bug' | 'other';
  title: string;
  content: string;
  status: 'open' | 'planned' | 'in-progress' | 'done' | 'declined';
  author: string;
  createdAt: string;
  votes: number;
  voted?: boolean;
  subject?: string;
  replies?: WishComment[];
}
