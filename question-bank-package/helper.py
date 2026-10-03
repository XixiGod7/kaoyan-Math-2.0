# -*- coding: utf-8 -*-
"""
考研数学题库 Python 独立检索与管理工具包
"""
import os
import json
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

def _load_json(filename: str):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

class QuestionBank:
    def __init__(self):
        self._all_questions: Optional[List[Dict[str, Any]]] = None
        self._all_questions_map: Optional[Dict[str, Dict[str, Any]]] = None
        self._index_main: Optional[List[Dict[str, Any]]] = None
        self._index_all: Optional[List[Dict[str, Any]]] = None
        self._meta: Optional[Dict[str, Any]] = None
        self._syllabus: Optional[Dict[str, Any]] = None
        self._methods: Optional[List[Dict[str, Any]]] = None
        self._graph: Optional[Dict[str, Any]] = None

    def _ensure_loaded(self):
        if self._all_questions is None:
            self._all_questions = _load_json('all_questions.json')
            self._all_questions_map = {str(q['id']): q for q in self._all_questions}
            self._index_main = _load_json('index-main.json')
            self._index_all = _load_json('index-all.json')
            self._meta = _load_json('meta.json')
            self._syllabus = _load_json('syllabus.json')
            self._methods = _load_json('pojue-methods.json')
            self._graph = _load_json('pojue-graph.json')

    def get_all_questions(self) -> List[Dict[str, Any]]:
        """获取全量 2,185 道真题"""
        self._ensure_loaded()
        return self._all_questions

    def get_main_questions(self) -> List[Dict[str, Any]]:
        """获取 2009-2026 近 18 年主线 912 道真题"""
        self._ensure_loaded()
        return self._index_main

    def get_question_by_id(self, qid: Any) -> Optional[Dict[str, Any]]:
        """根据题号检索单道题"""
        self._ensure_loaded()
        return self._all_questions_map.get(str(qid))

    def query(
        self,
        paper: Optional[str] = None,
        year: Optional[int] = None,
        qtype: Optional[str] = None,
        difficulty: Optional[int] = None,
        kp: Optional[str] = None,
        method: Optional[str] = None,
        keyword: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """多维度条件过滤"""
        self._ensure_loaded()
        results = self._all_questions

        if paper:
            results = [q for q in results if paper in q.get('papers', [])]
        if year:
            results = [q for q in results if q.get('year') == year]
        if qtype:
            results = [q for q in results if q.get('type') == qtype]
        if difficulty:
            results = [q for q in results if q.get('difficulty') == difficulty or q.get('difficultyEst') == difficulty]
        if kp:
            results = [
                q for q in results
                if any(kp in (k if isinstance(k, str) else k.get('kp', '')) for k in q.get('kps', []))
            ]
        if method:
            results = [
                q for q in results
                if any(method in m for m in q.get('methods', []))
            ]
        if keyword:
            results = [q for q in results if keyword in q.get('stem', '')]

        if limit is not None:
            return results[offset: offset + limit]
        return results[offset:]

    def get_paper(self, paper: str, year: int) -> List[Dict[str, Any]]:
        """获取某年份某卷种的完整试卷整套题目 (依原始试卷顺序排序)"""
        self._ensure_loaded()
        matched = [
            q for q in self._all_questions
            if q.get('year') == year and paper in q.get('papers', [])
        ]
        def sort_key(q):
            idx_map = q.get('indexByPaper', {})
            return idx_map.get(paper, q.get('index', 0))
        return sorted(matched, key=sort_key)

    def get_similar_questions(self, target: Any, count: int = 3) -> List[Dict[str, Any]]:
        """举一反三推荐：同招法、同考点相关真题"""
        self._ensure_loaded()
        if isinstance(target, dict):
            q = target
        else:
            q = self.get_question_by_id(target)
        if not q:
            return []

        q_methods = set(q.get('methods', []))
        q_kps = set([k if isinstance(k, str) else k.get('kp', '') for k in q.get('kps', [])])
        q_id = str(q.get('id'))
        q_papers = set(q.get('papers', []))
        q_type = q.get('type')

        scored = []
        for item in self._all_questions:
            if str(item.get('id')) == q_id:
                continue
            score = 0
            for m in item.get('methods', []):
                if m in q_methods:
                    score += 100
            for k in item.get('kps', []):
                name = k if isinstance(k, str) else k.get('kp', '')
                if name in q_kps:
                    score += 30
            if q_papers.intersection(set(item.get('papers', []))):
                score += 10
            if item.get('type') == q_type:
                score += 5
            if score > 0:
                scored.append((score, item))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:count]]

    def get_syllabus(self, paper: Optional[str] = None) -> Any:
        """获取考纲体系"""
        self._ensure_loaded()
        if paper:
            return self._syllabus.get(paper, [])
        return self._syllabus

    def get_methods(self, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取破题招法体系"""
        self._ensure_loaded()
        if domain:
            return [m for m in self._methods if m.get('domainName') == domain or m.get('domain') == domain]
        return self._methods

    def get_meta(self) -> Dict[str, Any]:
        """获取元数据概览"""
        self._ensure_loaded()
        return self._meta

# 单例导出
bank = QuestionBank()
