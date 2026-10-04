const db = require('../db');
const documents = ['user_wrong_book','user_favorites','user_notes','user_review','user_progress','user_exam_papers','user_paper_attempts','politics_state','english_state','english_storage','growth_state'];
function snapshot() {
  const data=Object.fromEntries(documents.map(name=>[name,db.readJSON(name,null)]));
  if(data.english_storage) data.english_storage=Object.fromEntries(Object.entries(data.english_storage).filter(([key])=>require('./english').validKey(key)));
  return {format:'yanzhuan-study',version:1,exportedAt:new Date().toISOString(),profile:{nickname:db.getProfile().nickname,examTrack:db.getProfile().examTrack},data};
}
function mount(app){
  app.get('/api/study/export',(req,res)=>{res.set('Cache-Control','no-store');res.set('Content-Disposition','attachment; filename="yanzhuan-study.json"');const data=snapshot(),scale=Number(req.query.fontScale)||1;data.preferences={fontScale:Math.max(.9,Math.min(1.4,scale)),theme:['dark','light'].includes(req.query.theme)?req.query.theme:'system'};res.json(data);});
}
module.exports={mount,snapshot,documents};
