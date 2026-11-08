import {test,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {SettingsStore,type SecretCipher} from '../src/storage';
const base=resolve('tests/artifacts','secrets-'+Date.now());
const cipher:SecretCipher={isEncryptionAvailable:()=>true,encryptString:()=>Buffer.from('OS-PROTECTED-BLOB'),decryptString:b=>{if(b.toString()!=='OS-PROTECTED-BLOB')throw new Error('bad cipher');return 'FAKE-KEY-123';}};
test('remembered key is encrypted, reloads, and opting out removes saved ciphertext',async()=>{
 const store=new SettingsStore('remember',base,()=>cipher);
 await store.save({rememberApiKey:true,apiKey:'FAKE-KEY-123',model:'test'});
 const raw=await readFile(join(store.directory,'settings.json'),'utf8');
 expect(raw).not.toContain('FAKE-KEY-123');expect(JSON.parse(raw).encryptedApiKey).toBeTruthy();
 expect((await new SettingsStore('remember',base,()=>cipher).load()).apiKey).toBe('FAKE-KEY-123');
 await store.save({rememberApiKey:false,apiKey:'FAKE-KEY-123'});
 const cleared=await store.load();expect(cleared.apiKey).toBeUndefined();
 expect(await readFile(join(store.directory,'settings.json'),'utf8')).not.toContain('encryptedApiKey');
});
test('unavailable encryption refuses plaintext persistence and preserves previous config',async()=>{
 const store=new SettingsStore('unavailable',base,()=>({...cipher,isEncryptionAvailable:()=>false}));
 await store.save({rememberApiKey:false,model:'old'});
 expect(()=>store.save({rememberApiKey:true,apiKey:'FAKE-KEY-123',model:'new'})).toThrow('系统加密不可用');
 expect((await store.load()).model).toBe('old');
});
test('clear removes ciphertext and session key from stored configuration',async()=>{
 const store=new SettingsStore('clear',base,()=>cipher);
 await store.save({rememberApiKey:true,apiKey:'FAKE-KEY-123'});
 await store.save({rememberApiKey:false,apiKey:'',online:false});
 expect(await store.load()).toEqual({rememberApiKey:false,online:false});
});
