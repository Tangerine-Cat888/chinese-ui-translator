import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateTranslation} from './core';
import {isRecord} from './validation';

export interface ProgressItem {text:string;role:string;value?:string}
export interface TranslationProgress {sourceHash:string;configHash:string;items:ProgressItem[]}
const roles=new Set(['','action','option','description','heading','tab','label','placeholder','tooltip']);
/** Separate atomic checkpoint; never exposed as an active dictionary. */
export class ProgressStore {
 private path:string;
 constructor(private directory:string,id:string,language:string){
  this.path=join(directory,'progress-'+createHash('sha256').update(JSON.stringify([id,language])).digest('hex')+'.json');
 }
 async load():Promise<TranslationProgress|undefined>{
  let raw:string;
  try{raw=await readFile(this.path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
  const data:unknown=JSON.parse(raw);
  if(!isRecord(data)||typeof data.sourceHash!=='string'||typeof data.configHash!=='string'||!Array.isArray(data.items))throw new Error('翻译进度文件损坏，原文件已保留');
  const items:ProgressItem[]=data.items.map((item:unknown)=>{
   if(!isRecord(item)||typeof item.text!=='string'||typeof item.role!=='string'||!roles.has(item.role))throw new Error('翻译进度文件损坏，原文件已保留');
   return {text:item.text,role:item.role,...(item.value===undefined?{}:{value:validateTranslation(item.text,item.value)})};
  });
  return {sourceHash:data.sourceHash,configHash:data.configHash,items};
 }
 async save(progress:TranslationProgress){
  await mkdir(this.directory,{recursive:true});
  await writeFile(this.path+'.pending',JSON.stringify(progress),'utf8');
  await rename(this.path+'.pending',this.path);
 }
}
