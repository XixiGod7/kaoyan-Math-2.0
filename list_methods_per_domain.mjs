import fs from 'fs';

const methods = JSON.parse(fs.readFileSync('public/data/pojue-methods.json', 'utf-8'));
const byDomain = {};
for (const m of methods) {
  if (!byDomain[m.domain]) byDomain[m.domain] = [];
  byDomain[m.domain].push(m);
}
for (const [dom, list] of Object.entries(byDomain)) {
  console.log(`${dom} (${list[0].domainName}): ${list.length} methods`);
}
