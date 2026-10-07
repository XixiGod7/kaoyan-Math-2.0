const fs = require('node:fs'), path = require('node:path');
const generated=require('./generated-directory.cjs'),source=path.join(__dirname,'../apps/english/public/data'),destination=path.join(__dirname,'../public/english-data'),target=generated.stage(destination);
fs.mkdirSync(target, {recursive:true}); fs.cpSync(source,target,{recursive:true});
const imagesTarget=path.join(__dirname,'../public/english-images'),imagesStage=generated.stage(imagesTarget);fs.cpSync(path.join(source,'../images'),imagesStage,{recursive:true});
const thumbsTarget=path.join(__dirname,'../public/english-thumbs'),thumbsStage=generated.stage(thumbsTarget);fs.cpSync(path.join(source,'../thumbs'),thumbsStage,{recursive:true});
const load = name => JSON.parse(fs.readFileSync(path.join(source,name),'utf8'));
const catalog = {version:1,source:'XixiGod7/kaoyan-english@f1120a0',papers:{},questions:{},passages:{},sentences:{},words:{},practice:{}};
for(const file of fs.readdirSync(path.join(source,'papers'))) {
  const paper=load('papers/'+file), ids=[];
  for(const task of paper.tasks) {
    const questions=task.detail.questions || [];
    if(task.meta.category==='writing' && !questions.length) questions.push({id:task.meta.index===8 ? 51:52,text:task.detail.directions || task.detail.article});
    for(const q of questions) { const id=`${paper.year}:${q.id}`; ids.push(id); catalog.questions[id]={id,year:String(paper.year),number:q.id,title:q.text || `${paper.year} 年第 ${q.id} 题`,answer:q.answer || null,objective:q.id<=45,options:(q.options || []).map(o=>o.charAt(0))}; }
  }
  catalog.papers[paper.year]=[...new Set(ids)];
}
for(const file of fs.readdirSync(path.join(source,'reading/passages'))) {
  const passage=load('reading/passages/'+file);
  for(const s of passage.sentences) catalog.sentences[s.sid]={sid:s.sid,s:s.s,zh:s.zh,passKey:passage.key};
  const questions=load('reading/questions/'+file);
  catalog.passages[passage.key]={};
  for(const [index,q] of questions.entries()) {
    const number=21+(passage.text_no-1)*5+((q.qNo>=1 && q.qNo<=5)?q.qNo-1:index),id=`${passage.year}:${number}`;
    catalog.passages[passage.key][q.id]=id;
    catalog.questions[id] ||= {id,year:String(passage.year),number,title:q.stem,answer:q.answer || null,objective:true,options:['A','B','C','D']};
    // The legacy precision-reading files often omit answers. Reuse the paper
    // reference for the same year and exam question; keep raw UI IDs as aliases.
    if(catalog.questions[id].answer)q.answer=catalog.questions[id].answer;
  }
  fs.writeFileSync(path.join(target,'reading/questions',file),JSON.stringify(questions));
}
for(const group of load('translation/translation_all.json'))for(const task of group.tasks){const id=group.year+':'+task.no;catalog.questions[id] ||= {id,year:String(group.year),number:task.no,title:group.year+' 年第 '+task.no+' 题翻译',objective:false,options:[]};}
for(const item of load('essay/essays_all.json')){const number=item.part==='A'?51:52,id=item.year+':'+number;catalog.questions[id] ||= {id,year:String(item.year),number,title:item.directions,objective:false,options:[]};}
const { compileLexicon } = require('./compile-lexicon.cjs');
const compiled = compileLexicon({ srcDir: source, targetDir: target });
for(const [word,entry] of Object.entries(compiled.unifiedDict.entries)) catalog.words[word]=entry.definition_cn || '';
fs.writeFileSync(path.join(target,'catalog.json'),JSON.stringify(catalog));
console.log(`英语资料：${Object.keys(catalog.papers).length} 套试卷，${Object.keys(catalog.questions).length} 道题，${Object.keys(catalog.sentences).length} 个精读句子，${Object.keys(catalog.words).length} 个统一词汇条目`);

for(const q of load('paraphrase/paraphrase_all.json').items) catalog.practice['paraphrase:'+q.id]={title:q.stem,answer:q.answer};
for(const q of load('phrases/phrases_all.json').items) catalog.practice['phrase:'+q.en]={title:q.en,answer:q.en};
fs.writeFileSync(path.join(target,'catalog.json'),JSON.stringify(catalog));

generated.publish(target,destination);generated.publish(imagesStage,imagesTarget);generated.publish(thumbsStage,thumbsTarget);
