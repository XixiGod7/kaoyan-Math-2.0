const { fail } = require("./validation");
const documents = [
  "user_notes",
  "user_progress",
  "user_wrong_book",
  "user_favorites",
  "user_review",
  "user_exam_papers",
  "user_paper_attempts",
  "english_storage",
  "english_state",
  "politics_state",
  "growth_state",
  "favorite_tags",
  "favorite_stars",
  "exam_drafts",
  "study_positions",
  "feedback_board",
  "qa_sessions",
  "sync_operations",
  "guest_imports",
  "restore_history",
];
const MAX_USER_BYTES = 24 * 1024 * 1024;
function check(changes, read) {
  const usage =
    read("storage_usage", null) ||
    Object.fromEntries(
      documents.map((name) => [
        name,
        Buffer.byteLength(JSON.stringify(read(name, null))),
      ]),
    );
  const previous = Object.values(usage).reduce((sum, n) => sum + n, 0);
  if (changes.get("english_storage")) {
    const count = Object.keys(changes.get("english_storage")).length;
    if (count > 2000 && count > Object.keys(read("english_storage", {})).length)
      fail("英语记录字段已满，请先导出并整理", 413);
  }
  for (const [name, value] of changes)
    if (documents.includes(name)) {
      const bytes = Buffer.byteLength(JSON.stringify(value));
      if (bytes > 8 * 1024 * 1024 && bytes > usage[name])
        fail("这类学习记录已超过 8 MB，请先导出或归档", 413);
      usage[name] = bytes;
    }
  const total = Object.values(usage).reduce((sum, n) => sum + n, 0);
  // Existing records remain readable and can always be reduced/exported.
  if (total > MAX_USER_BYTES && total > previous)
    fail("学习存储已满（24 MB），请导出并清理旧记录", 413);
  for (const name of ["user_exam_papers", "feedback_board"])
    if (changes.has(name) && changes.get(name)?.length > 500)
      fail("记录条目已满，请导出并清理旧记录", 413);
  if (changes.get("exam_drafts")) {
    const drafts = changes.get("exam_drafts");
    if (
      Object.keys(drafts).length > 100 ||
      Object.values(drafts).some(
        (v) => Buffer.byteLength(JSON.stringify(v)) > 100000,
      )
    )
      fail("最多保存 100 份草稿，每份不超过 100 KB", 413);
  }
  return usage;
}
module.exports = { check, MAX_USER_BYTES, documents };
