// Only dataset routes belong here. Statistics, solutions and progress stay private.
const datasets = require("../datasets");
const byId = new Map(datasets.allQuestionsList.map((q) => [String(q.id), q]));
function value(url) {
  const p = url.pathname,
    q = url.searchParams;
  if (p === "/api/syllabus") return datasets.syllabus;
  if (p === "/api/real/meta") return datasets.realMeta;
  if (p === "/api/real/index")
    return q.get("scope") === "all" ? datasets.indexAll : datasets.indexMain;
  if (p === "/api/real/questions") {
    if (q.has("ids"))
      return q
        .get("ids")
        .split(",")
        .slice(0, 100)
        .map((id) => byId.get(id.trim()))
        .filter(Boolean);
    if (q.has("paper") && q.has("year"))
      return datasets.allQuestionsList.filter(
        (row) =>
          row.year === Number(q.get("year")) &&
          row.papers.includes(q.get("paper")),
      );
    return datasets.allQuestionsList.slice(0, 50);
  }
  if (/^\/api\/real\/questions\/\d+$/.test(p))
    return byId.get(p.split("/").pop());
  if (p === "/api/methods/graph") return datasets.pojueGraph;
  if (p === "/api/methods")
    return q.has("domain")
      ? datasets.pojueMethods.filter((m) => m.domain === q.get("domain"))
      : datasets.pojueMethods;
}
function mount(app) {
  app.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method)) return next();
    const data = value(new URL(req.originalUrl, "http://public.local"));
    if (data === undefined) return next();
    res.set("Cache-Control", "public, max-age=300, must-revalidate");
    res.json(data);
  });
}
module.exports = { value, mount };
