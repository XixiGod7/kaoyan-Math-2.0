const db = require('../db');
const growth = require('./growth');
const {readContent} = require('./content');
const catalog = () => readContent('english-data/catalog.json');
const fresh = () => ({answers:{},cards:{},notes:{},exams:[]});
const state = () => db.readJSON('english_state',fresh());
const save = data => db.saveJSON('english_state',data);
function values(key,fallback) { try { return JSON.parse(db.readJSON('english_storage',{})[key] || 'null') || fallback; } catch { return fallback; } }
function stats() { const s=state(); return {answered:Object.keys(s.answers).length,correct:Object.values(s.answers).filter(a=>a.correct === true).length,favorites:values('kaoyan_favorite_sentences',[]).length,wrong:values('kaoyan_wrong_questions',[]).length,notes:Object.keys(s.notes).length,due:Object.values(s.cards).filter(c=>c.nextDue<=Date.now()).length,exams:s.exams.length}; }
const validKey = key => /^(kaoyan_(?:word_statuses|wordfreq_sidebar_collapsed|quiz_history|quiz_records|ebbinghaus_records|daily_session_state|daily_review_limit|favorite_sentences|wrong_questions|paraphrase_progress|phrase_dictate_history|reading_progress|trans_\d{4}|quiz_progress_\d{4}|essay_[a-zA-Z0-9_-]+|ai_reviews_[a-zA-Z0-9_-]+))$/.test(key);
function mount(app) {
  const wrap = fn => async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e.status || 400).json({ok:false,error:e.message});}};
  app.get('/api/english/storage',(req,res)=>res.json({items:db.readJSON('english_storage',{})}));
  app.post('/api/english/storage',wrap((req,res)=>{
    const patch=req.body.patch;if(!patch || Array.isArray(patch) || typeof patch!=='object') throw new Error('学习记录无效');
    const data=db.readJSON('english_storage',{});
    for(const [key,value] of Object.entries(patch)) {if(!validKey(key) || (value!==null && (typeof value!=='string' || value.length>1500000))) throw new Error('学习记录字段无效');if(value===null)delete data[key];else{if(!key.startsWith('kaoyan_essay_'))JSON.parse(value);data[key]=value;}}
    if(JSON.stringify(data).length>3500000)throw new Error('英语学习记录超过保存上限，请导出并清理旧记录');
    db.saveJSON('english_storage',data);res.json({ok:true});
  }));
  app.get('/api/english/note',(req,res)=>res.json({text:state().notes[req.query.sourceId]?.text || ''}));
  app.get('/api/english/stats',(req,res)=>res.json(stats()));
  app.post('/api/english/submit',wrap(async(req,res)=>{
    const c=await catalog(),{year,answers,passKey}=req.body;
    if(!answers || Array.isArray(answers) || typeof answers!=='object')throw new Error('作答无效');
    const y=String(year || passKey?.slice(0,4)), allowed=c.papers[y] || [];
    if(passKey && !/^(?:19|20)\d{2}-t[1-4]$/.test(passKey))throw new Error('篇目无效');
    if(passKey && (y!==passKey.slice(0,4) || !c.passages[passKey]))throw new Error('篇目年份不匹配');
    const entries=Object.entries(answers);if(!entries.length || entries.length>52)throw new Error('请先完成作答');
    const rows=entries.map(([number,answer])=>{
      const id=passKey?c.passages[passKey][number]:`${y}:${number}`,q=c.questions[id];
      if(!q)throw new Error('题目不存在');
      if(typeof answer!=='string' || !answer.trim() || answer.length>12000)throw new Error('答案无效');
      const picked=answer.trim(); if(q.objective && !(q.options || []).includes(picked))throw new Error('请选择有效选项');
      return {id,answer:picked,correct:q.answer ? picked===q.answer : null,at:Date.now()};
    });
    const full=!passKey && allowed.length>=50 && rows.length===allowed.length && allowed.every(id=>rows.some(r=>r.id===id));
    const s=state(); for(const row of rows) s.answers[row.id]=row;
    if(full){s.exams.unshift({year:y,at:Date.now(),correct:rows.filter(r=>r.correct).length});s.exams=s.exams.slice(0,100);}
    save(s);
    const rewards=full ? [growth.recordLearning('english','exam',y,{href:`/english?tab=quiz&year=${y}`})] : rows.map(row=>growth.recordLearning('english','answer',row.id,{href:`/english?tab=${passKey?'reading':'quiz'}&year=${y}${passKey?'&pass='+passKey:''}`}));
    res.json({ok:true,fullPaper:full,paperQuestions:allowed.length,sourceIncomplete:allowed.length!==52,correct:rows.filter(r=>r.correct).length,graded:rows.filter(r=>r.correct!==null).length,reward:{points:rewards.reduce((sum,r)=>sum+r.points,0)}});
  }));
  app.post('/api/english/review',wrap(async(req,res)=>{
    const {word,rating}=req.body,c=await catalog();
    if(typeof word!=='string' || !Object.hasOwn(c.words,word) || !['again','hard','good','easy'].includes(rating))throw new Error('复习内容无效');
    const s=state(),now=Date.now(),old=s.cards[word] || {stage:0,nextDue:0};
    const due=old.nextDue<=now; const stage=rating==='again'?0:rating==='hard'?old.stage:Math.min(8,old.stage+(rating==='easy'?2:1));
    const intervals=[5,30,720,1440,2880,5760,10080,21600,43200];
    s.cards[word]={stage,nextDue:now+intervals[stage]*60000,at:now};save(s);
    const reward=due ? growth.recordLearning('english','review','word:'+word,{href:'/english?review=1'}) : {credited:false,points:0};
    res.json({ok:true,reward,card:s.cards[word]});
  }));
  app.post('/api/english/practice',wrap(async(req,res)=>{
    const c=await catalog(),{id,answer}=req.body,q=c.practice[id];
    if(!q || typeof answer!=='string' || !answer.trim() || answer.length>1000)throw new Error('练习作答无效');
    if(id.startsWith('paraphrase:') && !/^[A-D]$/.test(answer))throw new Error('请选择有效选项');
    const correct=answer.trim().toLowerCase().replace(/\s+/g,' ')===q.answer.trim().toLowerCase().replace(/\s+/g,' ');
    const s=state();s.answers[id]={answer,correct,at:Date.now()};save(s);
    res.json({ok:true,correct,reward:growth.recordLearning('english','answer',id,{href:'/english?tab='+(id.startsWith('phrase:')?'phrases':'paraphrase')})});
  }));
  app.post('/api/english/note',wrap(async(req,res)=>{
    const c=await catalog(),{sourceId,text}=req.body;
    if(!Object.hasOwn(c.questions,sourceId) && !Object.hasOwn(c.sentences,sourceId))throw new Error('题目或句子不存在');
    if(typeof text!=='string' || text.length>10000)throw new Error('笔记无效');
    const s=state();if(text.trim())s.notes[sourceId]={text:text.trim(),at:Date.now()};else delete s.notes[sourceId];save(s);
    res.json({ok:true,reward:growth.recordLearning('english','note',sourceId,{text,href:'/english?tab=sentence-review'})});
  }));
  app.get('/api/english/library',wrap(async(req,res)=>{
    const c=await catalog(),s=state(),kind=req.query.kind,page=Math.max(0,Number(req.query.page)||0);let items=[];
    if(kind==='notes')items=Object.entries(s.notes).map(([id,n])=>({title:c.questions[id]?.title || c.sentences[id]?.s || id,text:n.text,href:c.questions[id]?`/english?tab=quiz&year=${c.questions[id].year}&note=${c.questions[id].number}`:`/english?tab=reading&pass=${c.sentences[id]?.passKey || '2026-t1'}`}));
    if(kind==='favorites')items=values('kaoyan_favorite_sentences',[]).map(n=>({title:n.s,text:n.zh,href:`/english?tab=reading&pass=${c.sentences[n.sid]?.passKey || '2026-t1'}`}));
    if(kind==='wrong')items=[...values('kaoyan_wrong_questions',[]).map(n=>({title:n.stem,text:n.analysis || '',href:`/english?tab=reading&pass=${n.passKey || '2026-t1'}`})),...Object.entries(s.answers).filter(([,n])=>n.correct===false).map(([id])=>({title:c.questions[id]?.title || c.practice[id]?.title || id,text:'参考答案：'+(c.questions[id]?.answer || c.practice[id]?.answer || '请结合原文核对'),href:c.practice[id]?'/english?tab='+(id.startsWith('phrase:')?'phrases':'paraphrase'):`/english?tab=quiz&year=${id.slice(0,4)}`}))];
    if(kind==='review')items=Object.entries(s.cards).filter(([,n])=>n.nextDue<=Date.now()).map(([word])=>({title:word,text:c.words[word],href:'/english?review=1'}));
    res.json({items:items.slice(page*20,page*20+20),total:items.length});
  }));
}
module.exports={mount,stats,validKey};
