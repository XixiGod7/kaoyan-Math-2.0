const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const db = require("../db");
const { AuthCore } = require("./auth-core");
const sync = require("./study-sync");
let registry;
function core() {
  if (registry) return registry;
  registry = new AuthCore(db.authStore());
  return registry;
}
function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "").split(";").map((p) => p.trim().split("=")),
  );
}
function cookie(name, value, maxAge = 2592000, secure = false) {
  return `${secure ? "__Host-" : ""}${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
function middleware(req, res, next) {
  if (db.hasSql()) return next();
  const hostname = String(req.hostname || "").toLowerCase(),
    trusted = new Set([
      "localhost",
      "127.0.0.1",
      "::1",
      "[::1]",
      ...(process.env.LOCAL_ALLOWED_HOSTS || "")
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ]);
  if (!trusted.has(hostname))
    return res
      .status(403)
      .json({
        error:
          "此本地入口不受信任，请使用 localhost 或配置 LOCAL_ALLOWED_HOSTS",
      });
  if (!req.path.startsWith("/api/")) return next();
  if (req.get("Sec-Fetch-Site") === "cross-site")
    return res.status(403).json({ error: "不允许跨站访问本地资料" });
  const origin = req.get("Origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    ((origin && origin !== `${req.protocol}://${req.get("Host")}`) ||
      req.get("Sec-Fetch-Site") === "cross-site")
  )
    return res.status(403).json({ error: "不允许跨站修改个人数据" });
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const values = cookies(req),
    secure = req.secure,
    guestName = secure ? "__Host-mb_session" : "mb_session",
    authName = secure ? "__Host-mb_auth" : "mb_auth";
  const guest = /^[a-f0-9-]{36}$/.test(values[guestName] || "")
      ? values[guestName]
      : randomUUID(),
    token = values[authName];
  if (!values[guestName]) {
    try {
      core().budget(req.ip, "guest", 60, 3600000);
    } catch (e) {
      return res.status(e.status || 429).json({ error: e.message });
    }
    res.append("Set-Cookie", cookie("mb_session", guest, 31536000, secure));
  }
  const identity = core().resolve(token);
  if (
    token &&
    !identity &&
    !req.path.startsWith("/api/auth/") &&
    req.path !== "/api/health"
  )
    return res
      .status(401)
      .json({ error: "登录已过期，请重新登录。待同步数据仍保存在本地" });
  req.auth = { guest, token, secure, identity };
  const current = identity || require("./auth-core").guestIdentity(guest);
  res.set("X-Study-Scope", current.scope);
  if (
    req.get("X-Study-Scope") &&
    req.get("X-Study-Scope") !== current.scope &&
    !req.path.startsWith("/api/auth/")
  )
    return res
      .status(401)
      .json({ error: "账号已切换，请刷新此页后继续；本地记录仍被保留" });
  db.runAsUser(
    { ...current, ...(!identity ? { storageScope: "guest:" + guest } : {}) },
    () => next(),
  );
}
function mount(app) {
  app.get("/api/auth/session", (req, res) =>
    res.json(
      req.auth?.identity || {
        ...db.identity(),
        expired: Boolean(req.auth?.token),
      },
    ),
  );
  app.post("/api/auth/:action", async (req, res) => {
    if (!req.auth) return res.status(404).json({ error: "账号接口不可用" });
    try {
      const { guest, token, secure } = req.auth,
        action = req.params.action;
      if (
        !["login", "register", "recover", "password", "logout"].includes(action)
      )
        return res.status(404).json({ error: "账号操作不存在" });
      const result = await core().action(action, req.body, token, req.ip);
      if (result.token) {
        if (["login", "register", "recover"].includes(action)) {
          const migration = require("./private-migration"),
            sourceIdentity = { scope: "guest:" + guest };
          const source = {
            exportStudy: (owner) =>
              db.runAsUser(sourceIdentity, () =>
                sync.exclusive(() =>
                  db.atomic(() => {
                    db.saveJSON("migration_owner", owner);
                    return sync.backup();
                  }),
                ),
              ),
            privateIndex: () =>
              db.runAsUser(sourceIdentity, () => migration.index()),
            readImage: (id) =>
              db.runAsUser(sourceIdentity, () =>
                db.readJSON("ai_image_" + id, null),
              ),
          };
          const target = {
            mergeGuest: (id, data) =>
              db.runAsUser(result, () =>
                sync.exclusive(() =>
                  db.atomic(() => sync.mergeGuest(id, data)),
                ),
              ),
            putImage: (id, metadata, image) =>
              db.runAsUser(result, () =>
                sync.exclusive(() =>
                  db.atomic(() => migration.putImage(id, metadata, image)),
                ),
              ),
            mergePrivate: (data) =>
              db.runAsUser(result, () =>
                sync.exclusive(() =>
                  db.atomic(() => migration.mergeIndex(data)),
                ),
              ),
          };
          const warning = await require("./account-migration").safely(
            guest,
            result,
            core(),
            source,
            target,
          );
          if (warning) result.migrationWarning = warning;
        }
        res.append(
          "Set-Cookie",
          cookie("mb_auth", result.token, 2592000, secure),
        );
      } else {
        res.append("Set-Cookie", cookie("mb_auth", "", 0, secure));
        res.append(
          "Set-Cookie",
          cookie("mb_session", randomUUID(), 31536000, secure),
        );
      }
      const { token: secret, ...value } = result;
      res.json({ ok: true, ...value });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message });
    }
  });
}
module.exports = { middleware, mount, cookie, core };
