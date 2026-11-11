// @vitest-environment jsdom
import {test,expect,vi} from 'vitest';
import {resolve} from 'node:path';
vi.mock('obsidian',()=>({
 Plugin:class{app:any;manifest:any;constructor(app:any,manifest:any){this.app=app;this.manifest=manifest;}async loadData(){return this.app.savedData??null;}async saveData(value:unknown){this.app.savedData=structuredClone(value);}addStatusBarItem(){return document.createElement('div');}addSettingTab(){}addCommand(){}registerEvent(){}},
 PluginSettingTab:class{},Setting:class{},Notice:class{},requestUrl:vi.fn()
}));
import Manager from '../src/manager';import {requestUrl} from 'obsidian';
test('role-aware translation and numeric templates persist, scope owned views, and reject broken model placeholders',async()=>{
 const old=process.env.APPDATA;process.env.APPDATA=resolve('tests/artifacts','manager-context-'+Date.now());
 const root=document.createElement('div');root.innerHTML='<button>Open</button><div class="setting-item-description">Open</div><div class="setting-item-description">Found 3 results</div>';document.body.append(root);
 const owned=document.createElement('div');owned.className='workspace-leaf-content';owned.dataset.type='fixture-view';owned.innerHTML='<button>Open</button>';
 const unknown=owned.cloneNode(true)as HTMLElement;document.body.append(owned,unknown);
 const instance={};const read=vi.fn().mockResolvedValue('x.setName("Open");x.setDesc(`Found ${count} results`);');
 const app:any={vault:{configDir:'.obsidian',adapter:{getBasePath:()=>'/fixture-context',read}},plugins:{plugins:{fixture:instance},manifests:{fixture:{id:'fixture',name:'Fixture Plugin',version:'1'},other:{id:'other',name:'Other Plugin',version:'1'}}},setting:{activeTab:{id:'fixture',containerEl:root}},workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:()=>void)=>f(),iterateAllLeaves:(f:(leaf:any)=>void)=>{f({view:{containerEl:owned,plugin:instance}});f({view:{containerEl:unknown}});}}};
 vi.mocked(requestUrl).mockReset();
 vi.mocked(requestUrl).mockImplementation((async(args:any)=>{
  const items=JSON.parse(JSON.parse(args.body).messages[1].content);
  return {status:200,json:{choices:[{message:{content:JSON.stringify(Object.fromEntries(items.map((item:any)=>[item.id,item.text.startsWith('Found ')?'找到 ⟦BA0⟧ 个结果':item.text.startsWith('Processed ')?'错误的无占位符译文':item.context.includes('UI role: description')?'开启状态':'打开'])))}}]}};
 })as any);
 let p=new Manager(app,{id:'bilingual-assistant'}as any);
 try{
  await p.onload();await p.saveService('custom',{baseUrl:'https://example.invalid',model:'test',apiKey:'',plan:'free'});
  await p.catalog.save({pluginId:'other',version:'1',sourceHash:'test',language:'简体中文',enabled:true,updatedAt:'now',strings:{Open:'展开'}});
  expect(await p.translatePlugin('fixture')).toEqual({total:2,translated:3});
  expect(root.querySelector('button')!.textContent).toBe('打开');expect(root.querySelector('.setting-item-description')!.textContent).toBe('开启状态');
  expect(owned.textContent).toBe('打开');expect(unknown.textContent).toBe('Open');
  const count=root.querySelectorAll('.setting-item-description')[1];count.textContent='Found 15 results';
  const calls=vi.mocked(requestUrl).mock.calls.length;p.onunload();
  p=new Manager(app,{id:'bilingual-assistant'}as any);await p.onload();
  expect(count.textContent).toBe('找到 15 个结果');expect(root.querySelector('.setting-item-description')!.textContent).toBe('开启状态');
  expect(await p.translatePlugin('fixture')).toEqual({total:2,translated:0});expect(requestUrl).toHaveBeenCalledTimes(calls);
  const saved=JSON.stringify(p.catalog.get('fixture','简体中文'));
  read.mockResolvedValue('x.setName("Open");x.setDesc(`Found ${count} results`);x.setDesc(`Processed ${count} items`);');
  await expect(p.translatePlugin('fixture')).rejects.toThrow('占位符');expect(JSON.stringify(p.catalog.get('fixture','简体中文'))).toBe(saved);
 }finally{p.onunload();root.remove();owned.remove();unknown.remove();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;vi.mocked(requestUrl).mockReset();}
});
test('new plugin refuses to run alongside the enabled old ID',async()=>{
 const p=new Manager({plugins:{enabledPlugins:new Set(['bilingual-assistant'])}}as any,{id:'chinese-ui-translator'}as any);
 await expect(p.onload()).rejects.toThrow('旧版汉化插件仍启用');p.onunload();
});
test('unloading cancels in-flight model discovery without waiting for the server',async()=>{
 vi.mocked(requestUrl).mockImplementation((()=>new Promise(()=>{}))as any);
 const p=new Manager({}as any,{id:'bilingual-assistant'}as any);
 const pending=p.fetchModels('custom',{apiKey:'',baseUrl:'http://localhost:18765/v1',model:'qa',plan:'free'}).catch(e=>e.name);
 p.onunload();expect(await pending).toBe('AbortError');
 await expect(p.fetchModels('custom',{apiKey:'',baseUrl:'http://localhost',model:'qa',plan:'free'})).rejects.toThrow('已卸载');
 vi.mocked(requestUrl).mockReset();
});
test('one-click persists translations; reopen, reload and incremental scan make no network requests; source never written',async()=>{
 const old=process.env.APPDATA;process.env.APPDATA=resolve('tests/artifacts','manager-'+Date.now());
 const root=document.createElement('div');root.innerHTML='<h2>Fixture Plugin</h2><div class="setting-item-name">Enable feature</div>';document.body.append(root);
 const source='new Setting(el).setName("Enable feature"); const name="Fixture Plugin";';
 const read=vi.fn().mockResolvedValue(source),write=vi.fn(()=>{throw new Error('Must not write plugin or notes');});
 const app:any={vault:{configDir:'.obsidian',adapter:{getBasePath:()=>'/fixture-manager',read,write}},plugins:{manifests:{fixture:{id:'fixture',name:'Fixture Plugin',version:'1',dir:'.obsidian/plugins/fixture'}}},setting:{activeTab:{id:'fixture',containerEl:root}},workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:(...args: any[]) => any)=>f(),iterateAllLeaves:()=>{}}};
 vi.mocked(requestUrl).mockImplementation((async(args:any)=>{const body=JSON.parse(args.body);const items=JSON.parse(body.messages[1].content);return{status:200,json:{choices:[{message:{content:JSON.stringify(Object.fromEntries(items.map((i:any)=>[i.id,'启用功能'])))}}]}};})as any);
 let p=new Manager(app,{id:'bilingual-assistant'}as any);
 try{
  await p.onload();await p.saveService('custom',{baseUrl:'https://example.invalid',model:'test',apiKey:'',plan:'free'});
  expect(requestUrl).not.toHaveBeenCalled();expect(root.textContent).toContain('Enable feature');
  expect(await p.translatePlugin('fixture')).toEqual({total:1,translated:1});expect(root.textContent).toContain('启用功能');expect(root.querySelector('h2')!.textContent).toBe('Fixture Plugin');
  const calls=vi.mocked(requestUrl).mock.calls.length;p.onunload();expect(root.textContent).toContain('Enable feature');
  p=new Manager(app,{id:'bilingual-assistant'}as any);await p.onload();expect(root.textContent).toContain('启用功能');expect(requestUrl).toHaveBeenCalledTimes(calls);
  expect(await p.translatePlugin('fixture')).toEqual({total:1,translated:0});expect(requestUrl).toHaveBeenCalledTimes(calls);
  await p.setEnabled('fixture',false);expect(root.textContent).toContain('Enable feature');
  await p.setEnabled('fixture',true);expect(root.textContent).toContain('启用功能');expect(write).not.toHaveBeenCalled();
  // A runtime-only label must survive leaving the settings tab to click supplement.
  const runtime=document.createElement('div');runtime.className='setting-item-description';runtime.textContent='Runtime connection status';root.append(runtime);
  const input=document.createElement('input');input.value='Private credential';root.append(input);
  p.refresh();expect(requestUrl).toHaveBeenCalledTimes(calls);
  app.setting.activeTab={id:'bilingual-assistant',containerEl:document.createElement('div')};p.refresh();
  expect(await p.translatePlugin('fixture')).toEqual({total:2,translated:1});
  expect(p.catalog.get('fixture','简体中文')!.strings).not.toHaveProperty('Private credential');
  runtime.remove();const afterSupplement=vi.mocked(requestUrl).mock.calls.length;
  expect(await p.translatePlugin('fixture')).toEqual({total:2,translated:0});expect(requestUrl).toHaveBeenCalledTimes(afterSupplement);
  const modal=document.createElement('div');modal.className='modal';modal.innerHTML='<div class="modal-title">Enable feature</div><input value="Enable feature">';document.body.append(modal);
  p.refresh();expect(modal.querySelector('.modal-title')!.textContent).toBe('启用功能');expect(modal.querySelector('input')!.value).toBe('Enable feature');
  await p.setEnabled('fixture',false);expect(modal.querySelector('.modal-title')!.textContent).toBe('Enable feature');modal.remove();
 }finally{p.onunload();root.remove();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;}
});

test('manager migrates saved keys and resolves the current keychain value for every model request',async()=>{
 const old=process.env.APPDATA;process.env.APPDATA=resolve('tests/artifacts','manager-keychain-'+Date.now());
 const secrets=new Map<string,string>();
 const app:any={
  secretStorage:{getSecret:(name:string)=>secrets.get(name)??null,setSecret:(name:string,value:string)=>secrets.set(name,value)},
  savedData:{schemaVersion:1,serviceId:'custom',uiEnabled:true,profiles:{custom:{apiKey:'OLD-KEY',baseUrl:'https://example.invalid/v1',model:'test',plan:'free'}}},
  vault:{configDir:'.obsidian',adapter:{getBasePath:()=>'/fixture-keychain',exists:async()=>false}},
  plugins:{manifests:{}},workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:()=>void)=>f(),iterateAllLeaves:()=>{}}
 };
 const p=new Manager(app,{id:'chinese-ui-translator'}as any);
 vi.mocked(requestUrl).mockReset();vi.mocked(requestUrl).mockResolvedValue({status:200,json:{data:[{id:'test'}]}}as any);
 try{
  await p.onload();
  expect(JSON.stringify(app.savedData)).not.toContain('OLD-KEY');
  expect(app.savedData.profiles.custom.apiKey).toBeUndefined();
  const profile=p.preferences.profiles.custom!;
  await p.fetchModels('custom',profile);
  expect((vi.mocked(requestUrl).mock.calls[0][0]as any).headers.Authorization).toBe('Bearer OLD-KEY');
  secrets.set(profile.secretName!,'ROTATED-KEY');
  await p.fetchModels('custom',profile);
  expect((vi.mocked(requestUrl).mock.calls[1][0]as any).headers.Authorization).toBe('Bearer ROTATED-KEY');
  secrets.clear();
  await expect(p.fetchModels('custom',profile)).rejects.toThrow('不存在');
  expect(requestUrl).toHaveBeenCalledTimes(2);
 }finally{p.onunload();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;}
});
