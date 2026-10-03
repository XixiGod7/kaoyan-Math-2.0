import fs from 'fs';

const text = fs.readFileSync('public/assets/GS06-CHcmjGvz.js', 'utf-8');
console.log('GS06 text length:', text.length);
console.log('Sample 1500 chars:');
console.log(text.slice(0, 1500));
