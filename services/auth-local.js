const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const db = require('../db');
const {AuthCore} = require('./auth-core');
const sync = require('./study-sync');
let registry;
function core() {
  if (registry) return registry;
  const file=path.join(db.dataDir,'auth','registry.json');
  const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
  const write=data=>{fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(data));fs.renameSync(temp,file);};
  registry=new AuthCore({get:key=>read()[key],set:(key,value)=>{const data=read();data[key]=value;const now=Date.now();for(const [k,v] of Object.entries(data))if((k.startsWith('rate:')&&now-v.at>900000)||(k.startsWith('session:')&&v.expires<now))delete data[k];write(data);},delete:key=>{const data=read();delete data[key];write(data);}});return registry;
}
function cookies(req) { return Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('='))); }
function cookie(name,value,maxAge=2592000,secure=false) {return `${secure?'__Host-':''}${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
function middleware(req,res,next) {
  if (db.hasSql() || !req.path.startsWith('/api/')) return next();
  const origin=req.get('Origin');
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && ((origin && origin!==`${req.protocol}://${req.get('Host')}`)||req.get('Sec-Fetch-Site')==='cross-site')) return res.status(403).json({error:'不允许跨站修改个人数据'});
  res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  const values=cookies(req),secure=req.secure,guestName=secure?'__Host-mb_session':'mb_session',authName=secure?'__Host-mb_auth':'mb_auth';
  const guest=/^[a-f0-9-]{36}$/.test(values[guestName]||'')?values[guestName]:randomUUID(),token=values[authName];
  if (!values[guestName]) res.append('Set-Cookie',cookie('mb_session',guest,31536000,secure));
  const identity=core().resolve(token);
  if(token&&!identity&&!req.path.startsWith('/api/auth/')&&req.path!=='/api/health')return res.status(401).json({error:'登录已过期，请重新登录。待同步数据仍保存在本地'});
  req.auth={guest,token,secure,identity};
  const current=identity||{authenticated:false,scope:'guest:'+guest};res.set('X-Study-Scope',current.scope);
  if(req.get('X-Study-Scope')&&req.get('X-Study-Scope')!==current.scope&&!req.path.startsWith('/api/auth/'))return res.status(401).json({error:'账号已切换，请刷新此页后继续；本地记录仍被保留'});
  if(!identity&&req.path!=='/api/health'&&!core().store.get('migration:legacy')) {
    const files=fs.existsSync(db.dataDir)?fs.readdirSync(db.dataDir).filter(name=>/^[a-zA-Z0-9_-]+\.json$/.test(name)):[];
    core().store.set('migration:legacy',{guest,at:Date.now()});
    db.runAsUser(current,()=>{for(const name of files)db.saveJSON(name.slice(0,-5),JSON.parse(fs.readFileSync(path.join(db.dataDir,name),'utf8')));});
  }
  db.runAsUser(current,()=>next());
}
function mount(app) {
  app.get('/api/auth/session',(req,res)=>res.json(req.auth?.identity || db.identity() || {authenticated:false}));
  app.post('/api/auth/:action',async(req,res)=>{
    if (!req.auth) return res.status(404).json({error:'账号接口不可用'});
    try {
      const {guest,token,secure}=req.auth,action=req.params.action;
      if(!['login','register','recover','password','logout'].includes(action))return res.status(404).json({error:'账号操作不存在'});
      const result=await core().action(action,req.body,token,req.ip);
      if(result.token){
        if(['login','register','recover'].includes(action) && core().claimGuest(guest,result.id)) {
          const snapshot=db.runAsUser({scope:'guest:'+guest},()=>sync.backup());
          db.runAsUser(result,()=>sync.mergeGuest(guest,snapshot));
          const migration=require('./private-migration'),index=db.runAsUser({scope:'guest:'+guest},()=>migration.index());
          for(const [id,metadata] of Object.entries(index.images)){const image=db.runAsUser({scope:'guest:'+guest},()=>db.readJSON('ai_image_'+id,null));db.runAsUser(result,()=>migration.putImage(id,metadata,image));}
          db.runAsUser(result,()=>migration.mergeIndex(index));
        }
        res.append('Set-Cookie',cookie('mb_auth',result.token,2592000,secure));
      }else{res.append('Set-Cookie',cookie('mb_auth','',0,secure));res.append('Set-Cookie',cookie('mb_session',randomUUID(),31536000,secure));}
      const {token:secret,...value}=result;res.json({ok:true,...value});
    }catch(e){res.status(e.status||400).json({error:e.message});}
  });
}
module.exports={middleware,mount,cookie};
