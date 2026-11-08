import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {validateTranslation} from './core';
import {isRecord} from './validation';
export interface Pack { pluginId:string; version:string; sourceHash:string; language:string; enabled:boolean; updatedAt:string; strings:Record<string,string> }
export class Catalog {
  private packs = new Map<string,Pack>();
  private pending=Promise.resolve();
  constructor(readonly directory:string){}
  private key(id:string,language:string){return JSON.stringify([id,language]);}
  get(id:string,language:string){return this.packs.get(this.key(id,language));}
  all(){return [...this.packs.values()];}
  async load(){
    let raw:string;
    try{raw=await readFile(join(this.directory,'translations.json'),'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
    const data:unknown=JSON.parse(raw);
    if(!Array.isArray(data))throw new Error('汉化词典格式损坏，原文件保留');
    const next=new Map<string,Pack>();
    for(const item of data as unknown[]){
      if(!isRecord(item)||typeof item.pluginId!=='string'||typeof item.language!=='string'||typeof item.version!=='string'||typeof item.sourceHash!=='string'||typeof item.updatedAt!=='string'||!isRecord(item.strings))throw new Error('汉化词典格式损坏，原文件保留');
      const strings=Object.fromEntries(Object.entries(item.strings).map(([source,value])=>[source,validateTranslation(source,value)]));
      const pack:Pack={pluginId:item.pluginId,language:item.language,version:item.version,sourceHash:item.sourceHash,updatedAt:item.updatedAt,enabled:item.enabled===true,strings};next.set(this.key(pack.pluginId,pack.language),pack);
    }
    this.packs=next;
  }
  save(pack:Pack){
    // Serialize commits and publish to memory only after the disk write succeeds.
    const snapshot={...pack,strings:{...pack.strings}};
    const operation=this.pending.catch(()=>{}).then(async()=>{
      const next=new Map(this.packs);next.set(this.key(snapshot.pluginId,snapshot.language),snapshot);
      await mkdir(this.directory,{recursive:true});
      const path=join(this.directory,'translations.json');
      await writeFile(path+'.pending',JSON.stringify([...next.values()],null,2),'utf8');
      await rename(path+'.pending',path);this.packs=next;
    });this.pending=operation;return operation;
  }
  lookup(text:string,language:string,pluginId:string|undefined,names:Set<string>,installed:Set<string>):string|undefined{
    if(names.has(text))return;
    if(pluginId){const p=this.get(pluginId,language);return p?.enabled&&Object.hasOwn(p.strings,text)?p.strings[text]:undefined;}
    const matches=this.all().filter(p=>p.enabled&&p.language===language&&installed.has(p.pluginId)&&Object.hasOwn(p.strings,text)).map(p=>p.strings[text]);
    // Unattributed menus use only unambiguous saved matches, never a network request.
    return matches.length&&matches.every(s=>s===matches[0])?matches[0]:undefined;
  }
}
