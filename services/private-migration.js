const db=require('../db');
function index(){return {config:db.getAiConfig(),images:db.readJSON('ai_images',{}),mathImages:db.readJSON('math_images',{}),sessions:db.getQaSessions()};}
function mergeIndex(value){
  if(value.config?.apiKey&&!db.getAiConfig().apiKey)db.saveAiConfig(value.config);
  db.saveJSON('math_images',{...value.mathImages,...db.readJSON('math_images',{})});
  const current=db.getQaSessions(),seen=new Set(current.map(v=>v.id));db.saveQaSessions([...current,...value.sessions.filter(v=>!seen.has(v.id))].slice(0,100));
}
function putImage(id,metadata,image){if(!/^[a-f0-9-]{36}$/.test(id)||!image)return;const images=db.readJSON('ai_images',{});if(images[id])return;if(Object.keys(images).length>=100||Object.values(images).reduce((n,m)=>n+m.size,0)+metadata.size>50*1024*1024)throw Object.assign(new Error('合并后图片超过保存上限；原访客图片仍保留，请整理后再次登录'),{status:413});db.saveJSON('ai_image_'+id,image);images[id]=metadata;db.saveJSON('ai_images',images);}
module.exports={index,mergeIndex,putImage};
