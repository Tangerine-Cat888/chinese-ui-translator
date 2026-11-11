import {randomUUID} from 'node:crypto';
import type {ServiceProfile} from './services';
import type {DataHost,Preferences} from './preferences';

export interface Keychain {getSecret(id:string):string|null;setSecret(id:string,value:string):void}
function storage(keychain?:Keychain):Keychain {
 if(!keychain)throw new Error('Obsidian 钥匙串不可用，原配置保留，请升级或重启 Obsidian');
 return keychain;
}
export function resolveProfile(profile:ServiceProfile,keychain?:Keychain):ServiceProfile {
 if(!profile.secretName)return {...profile};
 let key:string|null;
 try{key=storage(keychain).getSecret(profile.secretName);}catch{throw new Error('无法读取 Obsidian 钥匙串，请检查密钥关联');}
 if(!key)throw new Error('关联的密钥不存在或为空，请在翻译服务设置中重新选择');
 return {...profile,apiKey:key};
}
/** Never overwrite a shared secret. Verify new secrets before removing plaintext. */
export function securePreferences(preferences:Preferences,keychain?:Keychain):Preferences {
 const profiles:Preferences['profiles']={};
 for(const [id,profile] of Object.entries(preferences.profiles)){
  const safe={...profile};
  if(safe.apiKey){
   try{
    const store=storage(keychain);
    let name=safe.secretName;
    if(!name||store.getSecret(name)!==safe.apiKey){
     // Obsidian limits secret IDs to 64 lowercase letters, digits and dashes.
     name=`chinese-ui-${id}-${randomUUID().replaceAll('-','')}`;
     store.setSecret(name,safe.apiKey);
    }
    if(store.getSecret(name)!==safe.apiKey)throw new Error('verification failed');
    safe.secretName=name;
   }catch{throw new Error('密钥迁移到 Obsidian 钥匙串失败，原配置保留，请重试');}
  }
  safe.apiKey='';profiles[id as keyof typeof profiles]=safe;
 }
 return {...preferences,profiles};
}
export async function savePreferences(host:DataHost,preferences:Preferences,keychain?:Keychain):Promise<Preferences>{
 const safe=securePreferences(preferences,keychain);
 const profiles=Object.fromEntries(Object.entries(safe.profiles).map(([id,profile])=>{
  const {apiKey: _apiKey,...saved}=profile;return [id,saved];
 }));
 await host.saveData({...safe,profiles});
 return safe;
}
