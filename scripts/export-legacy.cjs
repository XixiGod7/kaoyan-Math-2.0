// Filesystem access by the owner is required; no first visitor can claim old data.
const fs=require('node:fs'),path=require('node:path');
const output=process.argv[2];if(!output)throw Error('用法：node scripts/export-legacy.cjs <输出 JSON 绝对路径>');
if(!path.isAbsolute(output))throw Error('请指定输出的绝对路径');
if(fs.existsSync(output))throw Error('输出文件已存在，请选择新文件名');
const backup=require('../services/study-export').snapshot();fs.writeFileSync(output,JSON.stringify(backup,null,2),{flag:'wx'});console.log('已导出旧本地学习资料，可在登录后通过「学习进度 → 恢复学习备份」导入。');
