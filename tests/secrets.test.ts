import {test,expect,vi} from 'vitest';
import {defaults,loadPreferences,profileFor} from '../src/preferences';
import {resolveProfile,savePreferences} from '../src/secrets';

function fixture(){
 const values=new Map<string,string>();
 const keychain={getSecret:vi.fn((id:string)=>values.get(id)??null),setSecret:vi.fn((id:string,value:string)=>{
  if(!/^[a-z0-9-]{1,64}$/.test(id))throw new Error('Invalid secret ID');
  values.set(id,value);
 })};
 let data:unknown={...defaults(),profiles:{deepseek:{...profileFor(defaults()),apiKey:'old-secret'}}};
 const host={loadData:async()=>structuredClone(data),saveData:vi.fn(async(value:unknown)=>{data=structuredClone(value);})};
 return {values,keychain,host};
}
test('migrates current plaintext once and reads key rotations without caching credentials',async()=>{
 const {host,keychain,values}=fixture();
 const prefs=await loadPreferences(host,vi.fn(),undefined,keychain);
 expect(JSON.stringify(await host.loadData())).not.toContain('old-secret');
 expect(JSON.stringify(await host.loadData())).not.toContain('apiKey');
 expect(profileFor(prefs).apiKey).toBe('');
 expect(resolveProfile(profileFor(prefs),keychain).apiKey).toBe('old-secret');
 values.set(profileFor(prefs).secretName!,'rotated');
 expect(resolveProfile(profileFor(prefs),keychain).apiKey).toBe('rotated');
 await loadPreferences(host,vi.fn(),undefined,keychain);
 expect(host.saveData).toHaveBeenCalledTimes(1);
});
test.each(['unavailable','write','readback','save'])('migration failure preserves plaintext source: %s',async failure=>{
 const {host,keychain}=fixture();const before=await host.loadData();
 if(failure==='write')keychain.setSecret.mockImplementation(()=>{throw new Error('sensitive-error');});
 if(failure==='readback')keychain.setSecret.mockImplementation(()=>{});
 if(failure==='save')host.saveData.mockRejectedValue(new Error('disk full'));
 await expect(loadPreferences(host,vi.fn(),undefined,failure==='unavailable'?undefined:keychain)).rejects.toThrow(failure==='save'?'disk full':'原配置保留');
 expect(await host.loadData()).toEqual(before);
 if(failure!=='save')expect(host.saveData).not.toHaveBeenCalled();
});
test('migration does not overwrite an existing shared secret and unlinking does not resurrect legacy keys',async()=>{
 const {host,keychain,values}=fixture();values.set('shared','other-plugin-key');
 const prefs=defaults();prefs.profiles.deepseek={...profileFor(prefs),apiKey:'new-key',secretName:'shared'};
 const saved=await savePreferences(host,prefs,keychain);
 expect(values.get('shared')).toBe('other-plugin-key');
 expect(resolveProfile(profileFor(saved),keychain).apiKey).toBe('new-key');
 saved.profiles.deepseek!.secretName='';
 await savePreferences(host,saved,keychain);
 const legacy=vi.fn(),previous=vi.fn();
 const reloaded=await loadPreferences(host,legacy,previous,keychain);
 expect(resolveProfile(profileFor(reloaded),keychain).apiKey).toBe('');
 expect(legacy).not.toHaveBeenCalled();expect(previous).not.toHaveBeenCalled();
 expect(values.size).toBe(2);
});
test('missing references fail closed, including services with optional keys',()=>{
 const {keychain}=fixture();
 expect(()=>resolveProfile({...profileFor(defaults()),secretName:'missing'},keychain)).toThrow('不存在');
 expect(()=>resolveProfile({...profileFor(defaults()),secretName:'missing'})).toThrow('无法读取');
});
test('all service keys must be verified before any plaintext configuration is replaced',async()=>{
 const {host,keychain}=fixture();const prefs=defaults();
 prefs.profiles.deepseek={...profileFor(prefs),apiKey:'first'};
 prefs.profiles.openai={...profileFor(prefs),apiKey:'second'};
 keychain.setSecret.mockImplementationOnce(()=>{throw new Error('locked');});
 await expect(savePreferences(host,prefs,keychain)).rejects.toThrow('原配置保留');
 expect(host.saveData).not.toHaveBeenCalled();
});
