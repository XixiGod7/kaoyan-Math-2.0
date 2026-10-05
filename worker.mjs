import { DurableObject } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';
import app from './server.js';
import db from './db.js';
import authModule from './services/auth-core.js';
import sync from './services/study-sync.js';
import localAuth from './services/auth-local.js';
import privateMigration from './services/private-migration.js';
import accountMigration from './services/account-migration.js';
import publicApi from './services/public-api.js';
import bodyLimit from './services/body-limit.js';

app.listen(3000);

export class AuthStore extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS registry (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const sql=ctx.storage.sql;
    this.auth=new authModule.AuthCore({
      get:key=>{const row=sql.exec('SELECT value FROM registry WHERE key = ?',key).toArray()[0];return row?JSON.parse(row.value):null;},
      set:(key,value)=>{sql.exec('INSERT INTO registry (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value));},
      delete:key=>sql.exec('DELETE FROM registry WHERE key = ?',key)
    });
    ctx.blockConcurrencyWhile(async()=>{await ctx.storage.setAlarm(Date.now()+3600000);});
  }
  async alarm() {
    this.ctx.storage.sql.exec("DELETE FROM registry WHERE ((key LIKE 'rate:%' OR key LIKE 'budget:%') AND json_extract(value,'$.at') < ?) OR (key LIKE 'session:%' AND json_extract(value,'$.expires') < ?)",Date.now()-3600000,Date.now());
    await this.ctx.storage.setAlarm(Date.now()+3600000);
  }
  resolve(token) { return this.auth.resolve(token); }
  claimGuest(guest,account) { return this.auth.claimGuest(guest,account); }
  budget(ip,kind,limit,windowMs) {try{this.auth.budget(ip,kind,limit,windowMs);return null;}catch(e){return {error:e.message,status:e.status};}}
  async action(action,body,token,ip) { try { return await this.auth.action(action,body,token,ip); } catch(e) { return {error:e.message,status:e.status||400}; } }
}
// Anonymous browser IDs retain their original stores; accounts get separate stores.
export class UserStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }

  async fetch(request) {
    const identity=JSON.parse(request.headers.get('X-Internal-Identity') || '{}');
    return db.runWithStorage(this.ctx.storage.sql, () => handleAsNodeRequest(3000, request), this.env.ASSETS, identity, this.ctx.storage);
  }
  run(callback){return db.runWithStorage(this.ctx.storage.sql,callback,this.env.ASSETS,undefined,this.ctx.storage);}
  exportStudy(owner) { return this.run(()=>sync.exclusive(()=>db.atomic(()=>{if(owner)db.saveJSON('migration_owner',owner);return sync.backup();}))); }
  mergeGuest(guest,data) { return this.run(()=>sync.exclusive(()=>db.atomic(()=>sync.mergeGuest(guest,data)))); }
  privateIndex(){return this.run(()=>privateMigration.index());}
  readImage(id){return this.run(()=>db.readJSON('ai_image_'+id,null));}
  putImage(id,metadata,image){return this.run(()=>sync.exclusive(()=>db.atomic(()=>privateMigration.putImage(id,metadata,image))));}
  mergePrivate(value){return this.run(()=>sync.exclusive(()=>db.atomic(()=>privateMigration.mergeIndex(value))));}
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (url.pathname === '/') url.pathname = '/hub/index.html';
      else if (url.pathname === '/library') url.pathname = '/hub/library.html';
      else if (url.pathname === '/english' || url.pathname.startsWith('/english/')) url.pathname = '/english-app/index.html';
      else if (url.pathname === '/politics' || url.pathname.startsWith('/politics/')) url.pathname = '/politics-app/index.html';
      else if (url.pathname === '/growth' || url.pathname.startsWith('/growth/')) {
        if (!/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname = '/growth/index.html';
      }
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('Origin');
      if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        return Response.json({ error: '不允许跨站修改个人数据' }, { status: 403 });
      }
    }
    if(request.method==='GET'){const value=publicApi.value(url);if(value!==undefined)return Response.json(value,{headers:{'Cache-Control':'public, max-age=300, must-revalidate','X-Content-Type-Options':'nosniff'}});}
    const cookieName = url.protocol === 'https:' ? '__Host-mb_session' : 'mb_session';
    const match = request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9-]{36})(?:;|$)`));
    const sessionId = match?.[1] || crypto.randomUUID();
    try {
      const registry=env.AUTH_STORE.getByName('accounts-v1');
      const ip=request.headers.get('CF-Connecting-IP')||'unknown';
      const limited=(!match||!['GET','HEAD','OPTIONS'].includes(request.method))?await registry.budget(ip,!match?'guest':'write',!match?60:300,!match?3600000:60000):null;
      if((!match||!['GET','HEAD','OPTIONS'].includes(request.method))&&limited)return Response.json({error:limited.error},{status:limited.status});
      const authName=url.protocol==='https:'?'__Host-mb_auth':'mb_auth';
      const token=request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${authName}=([a-f0-9]{64})(?:;|$)`))?.[1];
      const identity=token?await registry.resolve(token):null;
      const current=identity||authModule.guestIdentity(sessionId);
      if(request.headers.get('X-Study-Scope')&&request.headers.get('X-Study-Scope')!==current.scope&&!url.pathname.startsWith('/api/auth/'))return Response.json({error:'账号已切换，请刷新此页后继续；本地记录仍被保留'},{status:401,headers:{'Cache-Control':'private, no-store'}});
      let response;
      if(url.pathname.startsWith('/api/auth/')) {
        if(url.pathname==='/api/auth/session' && request.method==='GET')response=Response.json({...current,expired:Boolean(token&&!identity)});
        else if(request.method==='POST' && ['login','register','recover','password','logout'].includes(url.pathname.split('/').pop())) {
          const action=url.pathname.split('/').pop();
          if(!request.headers.get('Content-Type')?.includes('application/json'))return Response.json({error:'请提交有效账号信息'},{status:400});
          const bytes=await bodyLimit.boundedBytes(request,4096);
          let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw Object.assign(new Error('请提交有效 JSON 账号信息'),{status:400});}
          const result=await registry.action(action,body,token,request.headers.get('CF-Connecting-IP')||'unknown');
          if(result.error)response=Response.json({error:result.error},{status:result.status});
          else {
            if(result.token&&['login','register','recover'].includes(action)){const warning=await accountMigration.safely(sessionId,result,registry,env.USER_STORE.getByName(sessionId),env.USER_STORE.getByName(result.scope));if(warning)result.migrationWarning=warning;}
            const {token:secret,...value}=result;response=Response.json({ok:true,...value});
            response.headers.append('Set-Cookie',localAuth.cookie('mb_auth',secret||'',secret?2592000:0,url.protocol==='https:'));
            if(!secret)response.headers.append('Set-Cookie',localAuth.cookie('mb_session',crypto.randomUUID(),31536000,url.protocol==='https:'));
          }
        }else response=Response.json({error:'账号接口不存在'},{status:404});
      }else if(token&&!identity&&url.pathname!=='/api/health')response=Response.json({error:'登录已过期，请重新登录。待同步数据仍保存在本地'},{status:401});
      else {
        const headers=new Headers(request.headers);headers.set('X-Internal-Identity',JSON.stringify(current));
        response=await env.USER_STORE.getByName(identity?.scope||sessionId).fetch(new Request(request,{headers}));
      }
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Study-Scope',current.scope);
      if (!match && url.pathname!=='/api/auth/logout') headers.append('Set-Cookie', `${cookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      console.error(JSON.stringify({ event: 'api_error', path: url.pathname, message: error.message }));
      return Response.json({ error: error.status<500?error.message:'服务暂时不可用，请稍后再试' }, { status: error.status||500 });
    }
  }
};
