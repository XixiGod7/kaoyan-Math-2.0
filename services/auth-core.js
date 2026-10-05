const { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const digest = value => createHash('sha256').update(String(value)).digest('hex');
const SESSION_MS = 30 * 86400000;
let hashing = false;
const waiters = [];
async function passwordHash(password, salt) {
  if (hashing) {
    if (waiters.length >= 4) throw Object.assign(new Error('请求较多，请稍后重试'), { status: 429 });
    await new Promise(resolve => waiters.push(resolve));
  }
  hashing = true;
  try { return await new Promise((resolve, reject) => scrypt(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 }, (e, key) => e ? reject(e) : resolve(key.toString('hex')))); }
  finally { const next = waiters.shift(); if (next) next(); else hashing = false; }
}
function username(value) {
  const text = typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
  if (!/^[\p{L}\p{N}_-]{3,32}$/u.test(text) || ['__proto__','constructor','prototype'].includes(text)) throw Object.assign(new Error('用户名需为 3–32 个字母、汉字、数字、下划线或连字符'), { status: 400 });
  return text;
}
function checkPassword(value) {
  if (typeof value !== 'string' || [...value].length < 12 || [...value].length > 128 || Buffer.byteLength(value) > 512) throw Object.assign(new Error('密码需为 12–128 个字符'), { status: 400 });
}
const equal = (a, b) => /^[a-f0-9]{64}$/.test(a || '') && /^[a-f0-9]{64}$/.test(b || '') && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
class AuthCore {
  constructor(store) { this.store = store; }
  budget(ip,kind,limit,windowMs=60000) {
    const key='budget:'+digest(ip+':'+kind),now=Date.now(),prior=this.store.get(key);
    const item=prior&&now-prior.at<windowMs?{...prior,count:prior.count+1}:{at:now,count:1};
    this.store.set(key,item);if(item.count>limit)throw Object.assign(new Error('请求较多，请稍后再试'),{status:429});
  }
  rate(ip, name, action) {
    const now = Date.now(), key = 'rate:' + digest(ip + ':' + (action === 'register' ? action : name));
    const old = this.store.get(key) || { at: now, count: 0 };
    const next = now - old.at >= 900000 ? { at: now, count: 1 } : { ...old, count: old.count + 1 };
    this.store.set(key, next);
    const globalKey = 'rate:' + digest(ip + ':all'), prior = this.store.get(globalKey) || { at: now, count: 0 };
    const global = now - prior.at >= 900000 ? { at: now, count: 1 } : { ...prior, count: prior.count + 1 }; this.store.set(globalKey, global);
    if (next.count > 10 || global.count > 30) throw Object.assign(new Error('尝试次数过多，请 15 分钟后重试'), { status: 429 });
  }
  resolve(token) {
    if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
    const session = this.store.get('session:' + digest(token));
    if (!session || session.expires <= Date.now()) return null;
    const account = this.store.get('user:' + session.username);
    if (!account || account.epoch !== session.epoch) return null;
    return { authenticated: true, scope: 'account:' + account.id, username: account.username, id: account.id };
  }
  session(account) {
    const token = randomBytes(32).toString('hex');
    this.store.set('session:' + digest(token), { username: account.username, epoch: account.epoch, expires: Date.now() + SESSION_MS });
    return { token, authenticated: true, scope: 'account:' + account.id, username: account.username, id: account.id };
  }
  async action(action, body, token, ip) {
    if (action === 'logout') { if (/^[a-f0-9]{64}$/.test(token || '')) this.store.delete('session:' + digest(token)); return { ok: true }; }
    const current = this.resolve(token), name = username(action === 'password' ? current?.username : body.username);
    this.rate(ip, name, action);
    checkPassword(body.password);
    const key = 'user:' + name, account = this.store.get(key);
    if (action === 'register') {
      if (account) throw Object.assign(new Error('该用户名已被使用'), { status: 409 });
      const salt = randomBytes(16).toString('hex'), hash = await passwordHash(body.password, salt);
      if (this.store.get(key)) throw Object.assign(new Error('该用户名已被使用'), { status: 409 });
      const recoveryCode = randomBytes(24).toString('hex').match(/.{1,8}/g).join('-');
      const value = { id: randomUUID(), username: name, salt, hash, recovery: digest(recoveryCode), epoch: 1, createdAt: Date.now() };
      this.store.set(key, value); return { ...this.session(value), recoveryCode };
    }
    if (action === 'login') {
      const hash = await passwordHash(body.password, account?.salt || 'missing-account-dummy-salt');
      if (!account || !equal(hash, account.hash)) throw Object.assign(new Error('用户名或密码不正确'), { status: 401 });
      return this.session(account);
    }
    if (action === 'recover' || action === 'password') {
      if (!account || (action === 'recover' ? !equal(digest(String(body.recoveryCode || '').trim().toLowerCase()), account.recovery) : !current || !equal(await passwordHash(String(body.currentPassword || ''), account.salt), account.hash))) throw Object.assign(new Error('账号信息或恢复凭据不正确'), { status: 401 });
      const epoch = account.epoch, salt = randomBytes(16).toString('hex'), hash = await passwordHash(body.password, salt);
      if (this.store.get(key)?.epoch !== epoch) throw Object.assign(new Error('凭据已更新，请重新登录'), { status: 409 });
      const recoveryCode = randomBytes(24).toString('hex').match(/.{1,8}/g).join('-');
      const value = { ...account, salt, hash, recovery: digest(recoveryCode), epoch: epoch + 1 };
      this.store.set(key, value); return { ...this.session(value), recoveryCode };
    }
    throw Object.assign(new Error('账号操作不存在'), { status: 404 });
  }
  claimGuest(guest, account) {
    const key = 'claim:' + guest, existing = this.store.get(key);
    if (existing && existing !== account) return false;
    this.store.set(key, account); return true;
  }
}
const guestIdentity=guest=>({authenticated:false,scope:'guest:'+digest('study-scope:'+guest)});
module.exports = { AuthCore, digest, guestIdentity };
