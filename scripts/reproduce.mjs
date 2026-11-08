import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const {version,id}=JSON.parse(await readFile('manifest.json','utf8'));
const base=resolve(`work/release-${version}/reproduce-`+Date.now());
const files=['package.json','package-lock.json','manifest.json','versions.json','LICENSE','build.mjs','styles.css','tsconfig.json','vitest.config.ts','eslint.config.mjs'];
for(const dir of ['src','tests','scripts'])for(const entry of await readdir(dir,{withFileTypes:true}))if(entry.isFile())files.push(dir+'/'+entry.name);
const report={node:process.version,source:{},runs:[]};
for(const file of files)report.source[file]=createHash('sha256').update(await readFile(file)).digest('hex');
for(const name of ['clean-a','clean-b']){
 const cwd=join(base,name);await mkdir(cwd,{recursive:true});
 for(const file of files){await mkdir(resolve(cwd,file,'..'),{recursive:true});await copyFile(file,join(cwd,file));}
 const run={name,commands:[]};report.runs.push(run);
 for(const args of [['ci','--ignore-scripts','--cache',join(base,'npm-cache')],['run','check'],['test'],['run','lint'],['run','build'],['run','package'],['audit'],['ls','--all']]){
  const npm=process.env.npm_execpath||join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  const result=spawnSync(process.execPath,[npm,...args],{cwd,encoding:'utf8',timeout:180000});
  const log=args.join('-').replace(/[^\w-]/g,'_').slice(0,80)+'.log';
  await writeFile(join(cwd,log),(result.stdout||'')+(result.stderr||''));run.commands.push({args,exit:result.status,log});
  if(result.error||result.status!==0)throw new Error(`${name}: ${args.join(' ')} failed; see ${cwd}/${log}`);
 }
 run.artifacts={};for(const file of [`${id}/main.js`,`${id}/manifest.json`,`${id}/styles.css`,`${id}-${version}.zip`])run.artifacts[file]=createHash('sha256').update(await readFile(join(cwd,'dist',file))).digest('hex');
 console.log(name+' passed');
}
report.identical=JSON.stringify(report.runs[0].artifacts)===JSON.stringify(report.runs[1].artifacts);
await writeFile(join(base,'result.json'),JSON.stringify(report,null,2));if(!report.identical)throw new Error('Build mismatch');console.log(base);
