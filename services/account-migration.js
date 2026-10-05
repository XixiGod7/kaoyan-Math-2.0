// Platform adapters provide RPC or local storage. Each step is idempotent, so
// a subsequent login resumes interrupted migration without minting rewards.
async function migrate(guest, account, registry, source, target) {
  if (!(await registry.claimGuest(guest, account.id))) return;
  const snapshot = await source.exportStudy(account.id);
  await target.mergeGuest(guest, snapshot);
  const privateData = await source.privateIndex();
  for (const [id, metadata] of Object.entries(privateData.images))
    await target.putImage(id, metadata, await source.readImage(id));
  await target.mergePrivate(privateData);
}
async function safely(...args) {
  try {
    await migrate(...args);
    return null;
  } catch (e) {
    return "部分访客附件暂未合并，原资料仍保留；再次登录可重试。" + e.message;
  }
}
module.exports = { migrate, safely };
