import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {validateTranslation} from './core';
import {isRecord} from './validation';
import {renderNumeric} from './numeric-template';
export interface Pack { pluginId:string; version:string; sourceHash:string; language:string; enabled:boolean; updatedAt:string; strings:Record<string,string>; contexts?:Record<string,Record<string,string>> }
function contexts(value:unknown):Pack['contexts']{
 if(value===undefined)return;
 if(!isRecord(value))throw new Error('上下文词典格式损坏');
 return Object.fromEntries(Object.entries(value).map(([role,entries])=>{
  if(!['action','option','description','heading','tab','label','placeholder','tooltip'].includes(role)||!isRecord(entries))throw new Error('上下文词典格式损坏');
  return [role,Object.fromEntries(Object.entries(entries).map(([source,target])=>[source,validateTranslation(source,target)]))];
 }));
}
function variants(pack:Pack,text:string,role?:string):string[]{
 const exact=role?pack.contexts?.[role]:undefined;if(exact&&Object.hasOwn(exact,text))return [exact[text]];
 const values=Object.values(pack.contexts||{}).filter(entries=>Object.hasOwn(entries,text)).map(entries=>entries[text]);
 return values.length?values:Object.hasOwn(pack.strings,text)?[pack.strings[text]]:[];
}
const agree=(values:string[])=>values.length&&values.every(value=>value===values[0])?values[0]:undefined;
export class Catalog {
  private packs = new Map<string,Pack>();
  private templateSources=new WeakMap<Pack,string[]>();
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
      const pack:Pack={pluginId:item.pluginId,language:item.language,version:item.version,sourceHash:item.sourceHash,updatedAt:item.updatedAt,enabled:item.enabled===true,strings,contexts:contexts(item.contexts)};next.set(this.key(pack.pluginId,pack.language),pack);
    }
    this.packs=next;
  }
  save(pack:Pack){
    // Serialize commits and publish to memory only after the disk write succeeds.
    const snapshot={...pack,strings:{...pack.strings},contexts:contexts(pack.contexts)};
    const operation=this.pending.catch(()=>{}).then(async()=>{
      const next=new Map(this.packs);next.set(this.key(snapshot.pluginId,snapshot.language),snapshot);
      await mkdir(this.directory,{recursive:true});
      const path=join(this.directory,'translations.json');
      await writeFile(path+'.pending',JSON.stringify([...next.values()],null,2),'utf8');
      await rename(path+'.pending',path);this.packs=next;
    });this.pending=operation;return operation;
  }
  lookup(text:string,language:string,pluginId:string|undefined,names:Set<string>,installed:Set<string>,role?:string):string|undefined{
    if(names.has(text))return;
    if(pluginId){
      const p=this.get(pluginId,language);if(!p?.enabled||!installed.has(pluginId))return;
      const exact=variants(p,text,role);if(exact.length)return agree(exact);
      let sources=this.templateSources.get(p);
      if(!sources){sources=[...new Set([...Object.keys(p.strings),...Object.values(p.contexts||{}).flatMap(entries=>Object.keys(entries))])].filter(source=>source.includes('⟦BA0⟧'));this.templateSources.set(p,sources);}
      const matches=sources.flatMap(source=>variants(p,source,role).flatMap(target=>{const value=renderNumeric(source,target,text);return value===undefined?[]:[value];}));
      return agree(matches);
    }
    const matches=this.all().filter(p=>p.enabled&&p.language===language&&installed.has(p.pluginId)).flatMap(p=>variants(p,text,role));
    // Unattributed menus use only unambiguous saved matches, never a network request.
    return agree(matches);
  }
}
