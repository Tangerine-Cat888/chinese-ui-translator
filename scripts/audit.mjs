import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {readFileSync} from 'node:fs';

// Reviewed 2026-11-18: no upstream fix exists. Only trusted build globs reach
// picomatch; it is absent from the distributed plugin. Re-review within 30 days.
const advisory='https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const npm=process.env.npm_execpath||join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const result=spawnSync(process.execPath,[npm,'audit','--json'],{encoding:'utf8',timeout:120000});
if(result.error)throw result.error;
const report=JSON.parse(result.stdout);
if(report.error||!report.metadata||!report.vulnerabilities)throw new Error('Audit unavailable');
console.log(JSON.stringify(report,null,2));
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
const vulnerabilities=report.vulnerabilities;
function allowed(name,seen=new Set()){
 const item=vulnerabilities[name];
 if(!item||seen.has(name)||!item.nodes.length||!item.via.length)return false;
 if(item.nodes.some(node=>lock.packages[node]?.dev!==true))return false;
 const next=new Set(seen);next.add(name);
 return item.via.every(v=>typeof v==='string'?allowed(v,next):v.name==='picomatch'&&v.url===advisory);
}
const names=Object.keys(vulnerabilities);
if(names.length&&Date.now()>=Date.parse('2026-12-18T00:00:00Z'))throw new Error('Dependency exception expired; review upstream fix');
const blocked=names.filter(name=>!allowed(name));
if(blocked.length)throw new Error('Unreviewed vulnerabilities: '+blocked.join(', '));
if(names.length)console.warn('Known development-only advisory retained: '+advisory+' (expires 2026-12-18). Not a zero-warning audit.');
else console.log('No known vulnerabilities.');
