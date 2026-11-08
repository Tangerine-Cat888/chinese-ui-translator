import {readFile,writeFile} from 'node:fs/promises';
const version=process.argv[2];
if(!/^\d+\.\d+\.\d+$/.test(version??''))throw new Error('Use: node scripts/version.mjs x.y.z');
for(const file of ['package.json','package-lock.json','manifest.json']){
 const data=JSON.parse(await readFile(file,'utf8'));data.version=version;
 if(file==='package-lock.json')data.packages[''].version=version;
 await writeFile(file,JSON.stringify(data,null,2)+'\n');
}
const manifest=JSON.parse(await readFile('manifest.json','utf8'));
let versions={};try{versions=JSON.parse(await readFile('versions.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
versions[version]=manifest.minAppVersion;await writeFile('versions.json',JSON.stringify(versions,null,2)+'\n');
