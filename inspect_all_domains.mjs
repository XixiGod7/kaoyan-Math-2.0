import fs from 'fs';
import path from 'path';

const domainFiles = fs.readdirSync('public/assets').filter(f => /^(GL|GS|XD)\d{2}-.*\.js$/.test(f));
console.log('Total domain chunks in assets:', domainFiles.length);

for (const df of domainFiles) {
    const text = fs.readFileSync(path.join('public/assets', df), 'utf-8');
    // search for question ids or 5-digit numbers
    const fiveDigits = text.match(/\b\d{5}\b/g) || [];
    // search for years
    const years = text.match(/\b(19\d\d|20\d\d)\b/g) || [];
    console.log(`${df.slice(0, 4)}: size=${text.length}, 5-digit nums=${fiveDigits.length} (${fiveDigits.slice(0, 5).join(',')}), years=${years.length}`);
}
