import {test,expect,vi,beforeEach} from 'vitest';
vi.mock('obsidian',()=>({requestUrl:vi.fn()}));
import {requestUrl} from 'obsidian';
import {defaultProfile,serviceTransport,serviceUrl,listServiceModels} from '../src/services';
import {loadPreferences,profileFor} from '../src/preferences';
beforeEach(()=>vi.mocked(requestUrl).mockReset());
const request={messages:[{role:'user',content:JSON.stringify([{id:'0',text:'First label'},{id:'1',text:'Second label'}])}]};
test('plugin ID migration preserves profiles and writes once; clearing never reimports old data',async()=>{
 let data:any=null;
 const previous=vi.fn().mockResolvedValue({schemaVersion:1,serviceId:'custom',uiEnabled:false,profiles:{custom:{...defaultProfile('custom'),apiKey:'MIGRATION-FIXTURE',model:'saved-model'}}});
 const host={loadData:async()=>data,saveData:async(value:unknown)=>{data=structuredClone(value);}};
 const p=await loadPreferences(host,vi.fn(),previous);expect(p.uiEnabled).toBe(false);expect(profileFor(p).model).toBe('saved-model');expect(data.profiles.custom.apiKey).toBe('MIGRATION-FIXTURE');
 data.profiles.custom.apiKey='';expect(profileFor(await loadPreferences(host,vi.fn(),previous)).apiKey).toBe('');expect(previous).toHaveBeenCalledTimes(1);
});
test('malformed old ID configuration is preserved and never replaced with defaults',async()=>{
 const saveData=vi.fn();await expect(loadPreferences({loadData:async()=>null,saveData},vi.fn(),async()=>({schemaVersion:99}))).rejects.toThrow('格式不受支持');expect(saveData).not.toHaveBeenCalled();
});
test('migrate once to plain plugin data; clearing key never resurrects old encrypted settings',async()=>{
 let data:any=null;const legacy=vi.fn().mockResolvedValue({endpoint:'https://api.deepseek.com/chat/completions',apiKey:'FAKE-LEGACY-KEY',model:'old-model'});
 const host={loadData:async()=>data,saveData:async(value:unknown)=>{data=structuredClone(value);}};
 const prefs=await loadPreferences(host,legacy);expect(profileFor(prefs).apiKey).toBe('FAKE-LEGACY-KEY');expect(data.profiles.deepseek.apiKey).toBe('FAKE-LEGACY-KEY');
 data.profiles.deepseek.apiKey='';const cleared=await loadPreferences(host,legacy);expect(profileFor(cleared).apiKey).toBe('');expect(legacy).toHaveBeenCalledTimes(1);
});
test('provider profiles are isolated and full chat endpoint is normalized for model discovery',async()=>{
 const data={schemaVersion:1,serviceId:'custom',uiEnabled:true,profiles:{deepseek:{...defaultProfile('deepseek'),apiKey:'FIRST'},custom:{...defaultProfile('custom'),apiKey:'SECOND',baseUrl:'https://example.com/v1/chat/completions',model:'chosen'}}};
 const prefs=await loadPreferences({loadData:async()=>data,saveData:vi.fn()},vi.fn());
 expect(profileFor(prefs,'deepseek').apiKey).toBe('FIRST');expect(profileFor(prefs,'custom').apiKey).toBe('SECOND');expect(serviceUrl('custom',profileFor(prefs),true)).toBe('https://example.com/v1/models');
});
test('DeepL batches plain text and preserves returned order without model or prompt fields',async()=>{
 vi.mocked(requestUrl).mockResolvedValue({status:200,json:{translations:[{text:'第一项'},{text:'第二项'}]}}as any);
 const transport=serviceTransport('deepl',{...defaultProfile('deepl'),apiKey:'FAKE'});
 const result:any=await transport(request,new AbortController().signal);expect(JSON.parse(result.choices[0].message.content)).toEqual({'0':'第一项','1':'第二项'});
 const args=vi.mocked(requestUrl).mock.calls[0][0]as any;expect(args.url).toBe('https://api-free.deepl.com/v2/translate');expect(JSON.parse(args.body)).toEqual({text:['First label','Second label'],source_lang:'EN',target_lang:'ZH-HANS'});
});
test('DeepLX uses its own protocol and optional bearer token; cancellation stops remaining items',async()=>{
 const controller=new AbortController();vi.mocked(requestUrl).mockImplementation((async()=>{controller.abort();return {status:200,json:{code:200,data:'译文'}};})as any);
 await expect(serviceTransport('deeplx',{...defaultProfile('deeplx'),apiKey:'TOKEN'})(request,controller.signal)).rejects.toThrow();
 expect(requestUrl).toHaveBeenCalledTimes(1);expect((vi.mocked(requestUrl).mock.calls[0][0]as any).headers.Authorization).toBe('Bearer TOKEN');
});
test('model listing deduplicates IDs and HTTP failures do not echo credentials',async()=>{
 vi.mocked(requestUrl).mockResolvedValueOnce({status:200,json:{data:[null,{}, {id:''},{id:'b'},{id:'a'},{id:'b'}]}}as any);
 expect(await listServiceModels('deepseek',{...defaultProfile('deepseek'),apiKey:'SECRET'},new AbortController().signal)).toEqual(['a','b']);
 vi.mocked(requestUrl).mockResolvedValueOnce({status:401,json:{error:{message:'SECRET'}}}as any);
 await expect(listServiceModels('deepseek',{...defaultProfile('deepseek'),apiKey:'SECRET'},new AbortController().signal)).rejects.toThrow('密钥无效');
});
