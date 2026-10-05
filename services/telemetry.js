const { randomUUID } = require("node:crypto");
function middleware(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  const started = Date.now(),
    id = randomUUID();
  res.set("X-Request-Id", id);
  req.studyTiming = {};
  res.once("finish", () =>
    console.info(
      JSON.stringify({
        event: "study_request",
        id,
        route: req.route?.path || req.path,
        method: req.method,
        status: res.statusCode,
        durationMs: Date.now() - started,
        queueMs: req.studyTiming.queueMs || 0,
        persistMs: req.studyTiming.persistMs || 0,
        modelMs: req.studyTiming.modelMs || 0,
        bytes: Number(res.get("Content-Length")) || 0,
      }),
    ),
  );
  next();
}
module.exports = { middleware };
