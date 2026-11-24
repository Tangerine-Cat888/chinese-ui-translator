import {sha256Hex} from './hash';
import type {TranslationFiles} from './storage';
import {validateTranslation} from './core';
import {isRecord} from './validation';

export interface ProgressItem {text:string;role:string;value?:string;key?:string}
export interface TranslationProgress {sourceHash:string;configHash:string;items:ProgressItem[]}
const roles=new Set(['','action','option','description','heading','tab','label','placeholder','tooltip']);
/** Separate atomic checkpoint; never exposed as an active dictionary. */
export class ProgressStore {
 private name:string;
 constructor(private files:TranslationFiles,id:string,language:string){
  this.name='progress-'+sha256Hex(JSON.stringify([id,language]))+'.json';
 }
 async load():Promise<TranslationProgress|undefined>{
  const raw=await this.files.read(this.name);
  if(raw===undefined)return;
  const data:unknown=JSON.parse(raw);
  if(!isRecord(data)||typeof data.sourceHash!=='string'||typeof data.configHash!=='string'||!Array.isArray(data.items))throw new Error('翻译进度文件损坏，原文件已保留');
  const items:ProgressItem[]=data.items.map((item:unknown)=>{
   if(!isRecord(item)||typeof item.text!=='string'||typeof item.role!=='string'||!roles.has(item.role))throw new Error('翻译进度文件损坏，原文件已保留');
   if(item.key!==undefined&&typeof item.key!=='string')throw new Error('翻译进度条目标识损坏');
   return {text:item.text,role:item.role,...(typeof item.key==='string'?{key:item.key}:{}),...(item.value===undefined?{}:{value:validateTranslation(item.text,item.value)})};
  });
  return {sourceHash:data.sourceHash,configHash:data.configHash,items};
 }
 async save(progress:TranslationProgress){
  await this.files.write(this.name,JSON.stringify(progress));
 }
}
