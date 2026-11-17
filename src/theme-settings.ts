import {parseYaml} from 'obsidian';
import {createHash} from 'node:crypto';
import {isRecord} from './validation';
import {LocalUi} from './local-ui';
import type {Clock} from './clock';
import type {Catalog} from './catalog';

export const styleSettingsId='obsidian-style-settings';
export interface ThemeEntry {key:string;text:string;role:string;section:string;setting:string;context:string}
export interface ThemeSource {id:string;name:string;hash:string;path:string;entries:ThemeEntry[];sections:string[]}
export const themeId=(name:string)=>'theme:'+createHash('sha256').update(name).digest('hex');

/** Read only explicit UI fields. CSS rules, defaults, identifiers and input values are never candidates. */
export function extractTheme(source:string,name:string,path:string):ThemeSource{
 if(source.length>20_000_000)throw new Error('主题文件过大，暂不支持');
 const entries:ThemeEntry[]=[];const sections=new Set<string>();
 for(const match of source.matchAll(/\/\*!?\s*@settings[\r\n]+([\s\S]*?)\*\//g)){
  let block:unknown;try{block=parseYaml(match[1].replace(/\t/g,'    ')) as unknown;}catch{throw new Error('主题的 Style Settings 配置无法解析，未修改词典');}
  if(!isRecord(block)||typeof block.id!=='string'||!block.id||!Array.isArray(block.settings))throw new Error('主题的 Style Settings 配置格式不受支持');
  if(sections.has(block.id))throw new Error('主题存在重复的配置分组 ID，无法安全匹配');
  const section=block.id;sections.add(section);const ids=new Set<string>();
  for(const item of block.settings as unknown[]){
   if(!isRecord(item)||typeof item.id!=='string'||typeof item.type!=='string')continue;
   if(ids.has(item.id))throw new Error('主题存在重复的配置项 ID，无法安全匹配');ids.add(item.id);
   const setting=item.id;
   const context=JSON.stringify({theme:name,section,setting,type:item.type,title:item.title,description:item.description});
   const add=(value:unknown,role:string,field:string)=>{
    if(typeof value!=='string'||!/[a-z]/i.test(value)||/[\u3400-\u9fff]/.test(value)||!value.trim()||value.length>12000)return;
    const text=value.trim();entries.push({key:JSON.stringify([section,setting,field,text]),text,role,section,setting,context});
   };
   add(item.title,item.type==='heading'?'heading':'label','title');add(item.description,'description','description');
   if(Array.isArray(item.options))for(const option of item.options as unknown[]){
    if(typeof option==='string')add(option,'option','option:'+option);
    else if(isRecord(option)&&typeof option.value==='string')add(option.label,'option','option:'+option.value);
   }
  }
 }
 if(entries.length>20000)throw new Error('主题配置项过多，暂不支持');
 return {id:themeId(name),name,path,hash:createHash('sha256').update(source).digest('hex'),entries,sections:[...sections]};
}

/** One session per identified setting row; no dictionary ever leaks into another CSS source. */
export class ThemeUi {
 private sessions=new Map<HTMLElement,LocalUi>();
 constructor(private catalog:Catalog,private clock:Clock){}
 stop(){this.sessions.forEach(session=>session.stop());this.sessions.clear();}
 release(doc:Document){for(const [root,session] of this.sessions)if(root.ownerDocument===doc){session.stop();this.sessions.delete(root);}}
 refresh(roots:HTMLElement[],theme:ThemeSource|undefined,language:string){
  const wanted=new Map<HTMLElement,ThemeEntry[]>();
  const entriesByRow=new Map<string,ThemeEntry[]>();
  for(const entry of theme?.entries||[]){const key=JSON.stringify([entry.section,entry.setting]),entries=entriesByRow.get(key)||[];entries.push(entry);entriesByRow.set(key,entries);}
  if(theme&&this.catalog.get(theme.id,language)?.enabled)for(const root of roots){
   const headings=[...root.querySelectorAll<HTMLElement>('.style-settings-heading[data-level="0"][data-id]')];
   for(const section of theme.sections){
    const matches=headings.filter(el=>el.dataset.id===section);if(matches.length!==1)continue;
    const body=matches[0].nextElementSibling;if(!body?.matches('.style-settings-container'))continue;
    const rows=[...body.querySelectorAll<HTMLElement>('.setting-item[data-id]')];
    const counts=new Map<string,number>();for(const row of rows){const id=row.dataset.id!;counts.set(id,(counts.get(id)||0)+1);}
    for(const row of rows){
     const setting=row.dataset.id!;if(counts.get(setting)!==1)continue;
     const entries=entriesByRow.get(JSON.stringify([section,setting]));if(entries?.length)wanted.set(row,entries);
    }
   }
  }
  for(const [root,session] of this.sessions)if(!wanted.has(root)){session.stop();this.sessions.delete(root);}
  for(const [row,entries] of wanted)if(!this.sessions.has(row)&&theme){
   const id=theme.id;
   this.sessions.set(row,new LocalUi(row,(text,role)=>{
    const pack=this.catalog.get(id,language);if(!pack?.enabled)return;
    const values=entries.filter(entry=>entry.text===text&&(entry.role===role||(entry.role==='heading'&&role==='label'))).map(entry=>pack.strings[entry.key]).filter((value):value is string=>typeof value==='string');
    return values.length&&values.every(value=>value===values[0])?values[0]:undefined;
   },this.clock));
  }
 }
}
