export interface DictEntry {
  headword?: string;
  type?: string;
  phonetic?: string;
  definition_cn: string;
  is_kaoyan_key?: boolean;
  task_ids?: number[];
  sentence_ids?: Array<[number, string, string]>;
  sources?: string[];
  supplementary_cn?: string[];
  quality?: 'verified' | 'imported' | 'supplemented' | 'proper_noun' | 'compound' | 'needs_review';
}

export interface KaoyanDict {
  version: number;
  exam_type: string;
  paper: number;
  total?: number;
  entries: Record<string, DictEntry>;
}

export interface LexiconManifest {
  version: number;
  createdAt?: string;
  lexicon: {
    hash: string;
    path: string;
    hashedPath: string;
    entriesCount: number;
  };
  frequency: {
    hash: string;
    path: string;
    hashedPath: string;
    itemsCount: number;
  };
  quality: {
    totalEntries: number;
    mainEntries: number;
    statsEntries: number;
    intersection: number;
    statsExclusive: number;
    mainExclusive: number;
    emptyDefinitions: number;
    verifiedProperNouns: number;
    verifiedCompounds: number;
    contextProperNouns?: number;
    pendingReview?: string[];
    coreExamWords: number;
  };
}

export interface PaperQuestion {
  id: number;
  index: number;
  knowledge_tags_id: number;
  part: string;
  question_ids: number[];
  question_type: number;
  score: number;
  section: string;
  thumbnail_id: number;
  year: string;
}

export interface PaperGroup {
  id: string;
  name: string;
  questions: PaperQuestion[];
}

export interface KnowledgePoint {
  id: number;
  name: string;
  children?: KnowledgePoint[];
}

export interface WordFreqItem {
  word: string;
  entry: DictEntry;
  paperCount: number;
  totalCount: number;
  status: 'unknown' | 'familiar' | 'unfamiliar'; // 未标, 熟词, 生词
}
