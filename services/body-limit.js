async function boundedBytes(request, limit) {
  const length = request.headers.get("Content-Length");
  if (length && Number(length) > limit) {
    await request.body?.cancel();
    throw Object.assign(new Error("内容超过保存大小限制"), { status: 413 });
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(),
    chunks = [];
  let count = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      count += part.value.byteLength;
      if (count > limit)
        throw Object.assign(new Error("内容超过保存大小限制"), { status: 413 });
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
module.exports = { boundedBytes };
