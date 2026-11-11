import {savePreferences,type Keychain} from './secrets';
import {defaultProfile,services,type ServiceId,type ServiceProfile} from './services';
import {isRecord} from './validation';
export interface Preferences {schemaVersion:1;serviceId:ServiceId;profiles:Partial<Record<ServiceId,ServiceProfile>>;uiEnabled:boolean}
export interface DataHost {loadData():Promise<unknown>;saveData(data:unknown):Promise<void>}
export function defaults():Preferences{return {schemaVersion:1,serviceId:'deepseek',profiles:{deepseek:defaultProfile('deepseek')},uiEnabled:true};}
export function profileFor(p:Preferences,id=p.serviceId){return {...defaultProfile(id),...p.profiles[id]};}
export async function loadPreferences(host:DataHost,legacy:()=>Promise<Record<string,unknown>>,previous?:()=>Promise<unknown>,keychain?:Keychain):Promise<Preferences>{
 let raw=await host.loadData();let migrated=false;
 if((raw===null||raw===undefined)&&previous){raw=await previous();migrated=raw!==null&&raw!==undefined;}
 if(raw!==null&&raw!==undefined){
  if(!isRecord(raw)||raw.schemaVersion!==1)throw new Error('插件配置格式不受支持，原文件保留');
  const data=raw,p=defaults();if(typeof data.serviceId==='string'&&Object.hasOwn(services,data.serviceId))p.serviceId=data.serviceId as ServiceId;
  p.uiEnabled=data.uiEnabled!==false;p.profiles={};
  for(const id of Object.keys(services) as ServiceId[]){const saved=isRecord(data.profiles)?data.profiles[id]:undefined;if(!isRecord(saved))continue;const profile=defaultProfile(id);for(const key of ['apiKey','baseUrl','model','secretName'] as const)if(typeof saved[key]==='string')profile[key]=saved[key];profile.plan=saved.plan==='pro'?'pro':'free';p.profiles[id]=profile;}
  if(migrated||Object.values(p.profiles).some(profile=>!!profile.apiKey))return savePreferences(host,p,keychain);
  return p;
 }
 const old=await legacy(),p=defaults();let id:ServiceId='deepseek';const endpoint=typeof old.endpoint==='string'?old.endpoint:'';
 if(endpoint){try{const host=new URL(endpoint).hostname;id=host==='api.deepseek.com'?'deepseek':host==='api.openai.com'?'openai':host==='openrouter.ai'?'openrouter':'custom';}catch{id='custom';}}
 const profile=defaultProfile(id);if(endpoint)profile.baseUrl=endpoint.replace(/\/chat\/completions\/?$/,'');if(typeof old.model==='string'&&old.model)profile.model=old.model;if(typeof old.apiKey==='string')profile.apiKey=old.apiKey;
 p.serviceId=id;p.profiles={[id]:profile};p.uiEnabled=old.uiEnabled!==false;
 // Once written, even an explicitly cleared key stays cleared: legacy is never reimported.
 return savePreferences(host,p,keychain);
}
