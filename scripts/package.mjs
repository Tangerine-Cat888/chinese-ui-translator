// Deterministic uncompressed ZIP: fixed DOS timestamp, UTF-8 names, explicit allowlist.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await import('./release-check.mjs');
const m=JSON.parse(await readFile('manifest.json','utf8'));
const parts=[],central=[];let offset=0;
function crc32(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
for(const file of ['main.js','manifest.json','styles.css']){
 const data=await readFile(`dist/${m.id}/${file}`),name=Buffer.from(`${m.id}/${file}`),crc=crc32(data);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);header.writeUInt16LE(0x800,8);header.writeUInt16LE(33,14);header.writeUInt32LE(crc,16);header.writeUInt32LE(data.length,20);header.writeUInt32LE(data.length,24);header.writeUInt16LE(name.length,28);header.writeUInt32LE(offset,42);
 parts.push(local,name,data);central.push(header,name);offset+=local.length+name.length+data.length;
}
const index=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(3,8);end.writeUInt16LE(3,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...parts,index,end]);const path=`dist/chinese-ui-translator-${m.version}.zip`;
await writeFile(path,zip);await writeFile(path+'.sha256',createHash('sha256').update(zip).digest('hex')+'  '+path.split('/').at(-1)+'\n');console.log(path);
