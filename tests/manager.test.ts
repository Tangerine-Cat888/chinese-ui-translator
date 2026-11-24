// @vitest-environment jsdom
import {test,expect,vi} from 'vitest';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
vi.mock('../src/translation-confirm',()=>({confirmLargeTranslation:vi.fn(async()=>true)}));
import {confirmLargeTranslation} from '../src/translation-confirm';
vi.mock('obsidian',()=>({
 Plugin:class{app:any;manifest:any;constructor(app:any,manifest:any){this.app=app;this.manifest=manifest;}async loadData(){return this.app.savedData??null;}async saveData(value:unknown){this.app.savedData=structuredClone(value);}addStatusBarItem(){if(this.app.mobile)throw new Error('No status bar on mobile');return document.createElement('div');}addSettingTab(){}addCommand(command:{id:string;callback:()=>void}){this.app.commands?.set(command.id,command.callback);}registerEvent(){}},
 Platform:{isDesktop:true,isDesktopApp:true,isMobile:false},FileSystemAdapter:class{static [Symbol.hasInstance](value:unknown){return !!value&&typeof (value as {getBasePath?:unknown}).getBasePath==='function';}},normalizePath:(path:string)=>path,
 PluginSettingTab:class{},Setting:class{},Notice:class{},requestUrl:vi.fn(),parseYaml:(text:string)=>createRequire(import.meta.url)('js-yaml').load(text)
}));
import Manager from '../src/manager';import {Platform,requestUrl} from 'obsidian';

test('mobile opens settings without a status bar and keeps completed translations and checkpoints in its vault',async()=>{
 const root=document.createElement('div');root.innerHTML='<button>Open</button>';document.body.append(root);
 const target='custom-profile/plugins/fixture/main.js';
 const dir='custom-profile/plugins/chinese-ui-translator';
 const files=new Map([[target,'x.setName("Open");']]);
 const write=vi.fn(async(path:string,data:string)=>{files.set(path,data);});
 const process=vi.fn(async(path:string,update:(data:string)=>string)=>{
  const current=files.get(path);if(current===undefined)throw new Error('File missing');
  const updated=update(current);files.set(path,updated);return updated;
 });
 const openTabById=vi.fn();
 const commands=new Map<string,()=>void>();
 const app:any={
  mobile:true,commands,
  vault:{configDir:'custom-profile',adapter:{exists:async(path:string)=>files.has(path),read:async(path:string)=>files.get(path),write,process}},
  setting:{activeTab:{id:'fixture',containerEl:root},open:vi.fn(),openTabById},
  plugins:{manifests:{fixture:{id:'fixture',name:'Fixture',version:'1'}}},
  workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:()=>void)=>f(),iterateAllLeaves:()=>{}}
 };
 const platform={...Platform};
 Platform.isDesktop=false;Platform.isDesktopApp=false;Platform.isMobile=true;
 const request=vi.mocked(requestUrl);
 request.mockReset();
 request.mockResolvedValue({status:200,json:{choices:[{message:{content:'{"0":"打开"}'}}]}} as any);
 const manifest={id:'chinese-ui-translator'} as any;
 let plugin=new Manager(app,manifest);
 try{
  await plugin.onload();
  commands.get('manage-translations')!();
  expect(openTabById).toHaveBeenCalledWith(manifest.id);
  await plugin.saveService('custom',{baseUrl:'https://example.invalid',model:'fixture',apiKey:'',plan:'free'});
  await expect(plugin.translatePlugin('fixture')).resolves.toEqual({total:1,translated:1});
  expect(root.textContent).toBe('打开');
  expect(write.mock.calls.map(([path])=>path)).toEqual([expect.stringMatching(new RegExp('^'+dir+'/progress-')),dir+'/translations.json']);
  expect(process.mock.calls.map(([path])=>path)).toEqual([expect.stringMatching(new RegExp('^'+dir+'/progress-'))]);
  plugin.onunload();
  plugin=new Manager(app,manifest);await plugin.onload();
  expect(root.textContent).toBe('打开');
  await plugin.setEnabled('fixture',false);expect(root.textContent).toBe('Open');
  await plugin.setEnabled('fixture',true);expect(root.textContent).toBe('打开');
  expect(request).toHaveBeenCalledTimes(1);
  const catalog=dir+'/translations.json';
  process.mockRejectedValueOnce(new Error('write failed'));
  await expect(plugin.setEnabled('fixture',false)).rejects.toThrow('write failed');
  expect(root.textContent).toBe('打开');
  expect(JSON.parse(files.get(catalog)!)[0].enabled).toBe(true);
  expect(files.get(target)).toBe('x.setName("Open");');
 }finally{plugin.onunload();root.remove();Object.assign(Platform,platform);request.mockReset();}
});

test('restoring a Copilot dictionary also restores local adapter fallbacks without network requests',async()=>{
 const old=process.env.APPDATA;process.env.APPDATA=resolve('tests/artifacts','manager-fallback-'+Date.now());
 const root=document.createElement('div');root.innerHTML='<span class="tw-text-xs tw-text-muted">3 loaded</span>';document.body.append(root);
 const app:any={vault:{configDir:'.obsidian',adapter:{getBasePath:()=>'/fixture-fallback',exists:async()=>false,read:async()=>''}},plugins:{manifests:{copilot:{id:'copilot',name:'Copilot',version:'1'}}},setting:{activeTab:{id:'copilot',containerEl:root}},workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:()=>void)=>f(),iterateAllLeaves:()=>{}}};
 const p=new Manager(app,{id:'chinese-ui-translator'}as any);vi.mocked(requestUrl).mockReset();
 try{
  await p.onload();expect(root.textContent).toBe('3 loaded');
  await p.catalog.save({pluginId:'copilot',version:'1',sourceHash:'test',language:'简体中文',enabled:true,updatedAt:'now',strings:{}});
  await p.setEnabled('copilot',true);expect(root.textContent).toBe('3 项已加载');
  await p.setEnabled('copilot',false);expect(root.textContent).toBe('3 loaded');
  await p.setEnabled('copilot',true);expect(root.textContent).toBe('3 项已加载');expect(requestUrl).not.toHaveBeenCalled();
 }finally{p.onunload();root.remove();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;}
});
test('checkpoints resume after cancellation, reload, source changes and partial response failure',async()=>{
 const old=process.env.APPDATA;process.env.APPDATA=resolve('tests/artifacts','manager-resume-'+Date.now());
 let labels=Array.from({length:25},(_,i)=>`Resume feature ${i}`);
 const app:any={vault:{configDir:'.obsidian',adapter:{getBasePath:()=>'/fixture-resume',exists:async()=>false,read:async()=>labels.map(text=>`x.setName(${JSON.stringify(text)});`).join('')}},plugins:{manifests:{fixture:{id:'fixture',name:'Fixture Plugin',version:'1'}}},workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:()=>void)=>f(),iterateAllLeaves:()=>{}}};
 let fail=false;const sent:string[]=[];
 vi.mocked(requestUrl).mockReset();vi.mocked(confirmLargeTranslation).mockClear();
 vi.mocked(requestUrl).mockImplementation((async(args:any)=>{
  const items=JSON.parse(JSON.parse(args.body).messages[1].content);sent.push(...items.map((item:any)=>item.text));
  return {status:200,json:{choices:[{message:{content:JSON.stringify(Object.fromEntries(items.map((item:any,index:number)=>[item.id,fail&&index===0?'':'译文 '+item.text])))}}]}};
 })as any);
 let p=new Manager(app,{id:'chinese-ui-translator'}as any);
 try{
  await p.onload();await p.saveService('custom',{baseUrl:'https://example.invalid',model:'test',apiKey:'',plan:'free'});
  await expect(p.translatePlugin('fixture',s=>{if(s==='正在汉化：已完成 12/25 条')p.cancel();})).rejects.toThrow('已取消');
  expect(sent).toEqual(labels.slice(0,12));expect(p.catalog.get('fixture','简体中文')).toBeUndefined();
  p.onunload();p=new Manager(app,{id:'chinese-ui-translator'}as any);await p.onload();
  labels=[...labels.slice(1),'Resume feature 25'];app.plugins.manifests.fixture.version='2';sent.length=0;fail=true;
  await expect(p.translatePlugin('fixture')).rejects.toThrow('格式无效');
  expect(sent).toEqual(labels.slice(11,23));expect(p.catalog.get('fixture','简体中文')).toBeUndefined();
  p.onunload();p=new Manager(app,{id:'chinese-ui-translator'}as any);await p.onload();sent.length=0;fail=false;
  expect(await p.translatePlugin('fixture')).toEqual({total:25,translated:3});
  expect(sent).toEqual(['Resume feature 12','Resume feature 24','Resume feature 25']);
  expect(Object.keys(p.catalog.get('fixture','简体中文')!.strings).sort()).toEqual([...labels].sort());
  expect(vi.mocked(confirmLargeTranslation).mock.calls.map(call=>call[1])).toEqual([25,14,3]);
 }finally{p.onunload();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;vi.mocked(requestUrl).mockReset();}
});
test('large plugins translate in bounded batches, reload offline, and preserve the dictionary on cancellation or failure',async()=>{
 const old=process.env.APPDATA;process.env.APPDATA=resolve('tests/artifacts','manager-large-'+Date.now());
 const labels=Array.from({length:3001},(_,i)=>`Feature label ${i}`);
 let source=labels.map(text=>`x.setName(${JSON.stringify(text)});`).join('');
 const read=vi.fn(async()=>source),write=vi.fn();
 const app:any={vault:{configDir:'.obsidian',adapter:{getBasePath:()=>'/fixture-large',read,write,exists:async()=>false}},plugins:{manifests:{fixture:{id:'fixture',name:'Fixture Plugin',version:'1'}}},workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:()=>void)=>f(),iterateAllLeaves:()=>{}}};
 vi.mocked(requestUrl).mockReset();
 vi.mocked(requestUrl).mockImplementation((async(args:any)=>{
  const items=JSON.parse(JSON.parse(args.body).messages[1].content);
  expect(items.length).toBeLessThanOrEqual(12);
  return {status:200,json:{choices:[{message:{content:JSON.stringify(Object.fromEntries(items.map((item:any)=>[item.id,'功能 '+item.text])))}}]}};
 })as any);
 let p=new Manager(app,{id:'chinese-ui-translator'}as any);
 try{
  await p.onload();await p.saveService('custom',{baseUrl:'https://example.invalid',model:'test',apiKey:'',plan:'free'});
  vi.mocked(confirmLargeTranslation).mockResolvedValueOnce(false);
  await expect(p.translatePlugin('fixture')).rejects.toThrow('已取消翻译');expect(requestUrl).not.toHaveBeenCalled();
  expect(await p.translatePlugin('fixture')).toEqual({total:3001,translated:3001});
  expect(Object.keys(p.catalog.get('fixture','简体中文')!.strings)).toEqual(labels);
  const calls=vi.mocked(requestUrl).mock.calls.length;p.onunload();
  p=new Manager(app,{id:'chinese-ui-translator'}as any);await p.onload();
  expect(await p.translatePlugin('fixture')).toEqual({total:3001,translated:0});expect(requestUrl).toHaveBeenCalledTimes(calls);
  const saved=JSON.stringify(p.catalog.get('fixture','简体中文'));
  source+='x.setName("New feature label");';
  await expect(p.translatePlugin('fixture',progress=>{if(progress.startsWith('正在汉化'))p.cancel();})).rejects.toThrow();
  expect(JSON.stringify(p.catalog.get('fixture','简体中文'))).toBe(saved);
  vi.mocked(requestUrl).mockRejectedValue(new Error('offline'));
  await expect(p.translatePlugin('fixture')).rejects.toThrow('无法连接');
  expect(JSON.stringify(p.catalog.get('fixture','简体中文'))).toBe(saved);expect(write).not.toHaveBeenCalled();
 }finally{p.onunload();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;vi.mocked(requestUrl).mockReset();}
},30000);
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


test('theme translation isolates settings, resumes failure, preserves values and invalidates on theme changes',async()=>{
 const old=process.env.APPDATA;process.env.APPDATA=resolve('tests/artifacts','theme-manager-'+Date.now());
 const config={name:'Fixture',id:'fixture-style',settings:[{id:'one',type:'variable-text',title:'Compact layout',description:'Keep text unchanged'},{id:'two',type:'heading',title:'Compact layout'}]};
 let source='/* @settings\n'+JSON.stringify(config)+'\n*/';
 const write=vi.fn();const root=document.createElement('div');document.body.append(root);
 root.innerHTML='<div class="style-settings-heading setting-item" data-level="0" data-id="fixture-style"><div class="setting-item-name">Fixture</div></div><div class="style-settings-container"><div class="setting-item" data-id="one"><div class="setting-item-name">Compact layout</div><div class="setting-item-description">Keep text unchanged</div><input value="PRIVATE"></div><div class="setting-item style-settings-heading" data-id="two"><div class="setting-item-name">Compact layout</div></div></div>';
 const app:any={customCss:{theme:'Fixture'},vault:{configDir:'.obsidian',adapter:{getBasePath:()=>'/theme-fixture',exists:async()=>false,read:async()=>source,write}},plugins:{plugins:{'obsidian-style-settings':{}},manifests:{'obsidian-style-settings':{id:'obsidian-style-settings',version:'1',name:'Style Settings'}}},setting:{activeTab:{id:'obsidian-style-settings',containerEl:root}},workspace:{containerEl:document.body,on:()=>({}),onLayoutReady:(f:()=>void)=>f(),iterateAllLeaves:()=>{}}};
 let fail=false;const sent:any[]=[];vi.mocked(requestUrl).mockReset();
 vi.mocked(requestUrl).mockImplementation((async(args:any)=>{const items=JSON.parse(JSON.parse(args.body).messages[1].content);sent.push(...items);return {status:200,json:{choices:[{message:{content:JSON.stringify(Object.fromEntries(items.map((item:any,i:number)=>[item.id,fail&&i===0?'':item.context.includes('"setting":"two"')?'紧凑分组':'译文 '+item.text])))}}]}};})as any);
 let p=new Manager(app,{id:'chinese-ui-translator'}as any);
 try{
  await p.onload();await p.saveService('custom',{baseUrl:'https://example.invalid',model:'test',apiKey:'',plan:'free'});
  expect(requestUrl).not.toHaveBeenCalled();expect(await p.translateTheme()).toEqual({total:3,translated:3});
  expect(root.textContent).toContain('译文 Compact layout');expect(root.textContent).toContain('紧凑分组');expect(root.querySelector('input')!.value).toBe('PRIVATE');expect(write).not.toHaveBeenCalled();
  const pack=p.catalog.all()[0];expect(pack.pluginId).toMatch(/^theme:/);const count=sent.length;
  await p.setEnabled(pack.pluginId,false);expect(root.textContent).not.toContain('译文');
  await p.setEnabled(pack.pluginId,true);expect(root.textContent).toContain('紧凑分组');
  expect(await p.translateTheme()).toEqual({total:3,translated:0});expect(sent.length).toBe(count);
  const saved=JSON.stringify(p.catalog.all());config.settings.push({id:'new',type:'variable-text',title:'Fresh setting',description:'Fresh description'});source='/* @settings\n'+JSON.stringify(config)+'\n*/';fail=true;
  await expect(p.translateTheme()).rejects.toThrow('格式无效');expect(JSON.stringify(p.catalog.all())).toBe(saved);
  fail=false;expect(await p.translateTheme()).toEqual({total:5,translated:1});
  p.onunload();p=new Manager(app,{id:'chinese-ui-translator'}as any);await p.onload();await new Promise(r=>setTimeout(r,1));p.refresh();expect(root.textContent).toContain('紧凑分组');
  const before=sent.length;app.customCss.theme='Other';p.refresh();expect(root.textContent).not.toContain('紧凑分组');expect(sent.length).toBe(before);
  app.customCss.theme='Fixture';config.settings.push({id:'last',type:'variable-text',title:'Last setting'});source='/* @settings\n'+JSON.stringify(config)+'\n*/';
  await expect(p.translateTheme(status=>{if(status.startsWith('正在汉化主题'))app.customCss.theme='Other';})).rejects.toThrow('主题已切换');
  expect(Object.keys(p.catalog.all()[0].strings)).toHaveLength(5);
  app.customCss.theme='Fixture';const stable=JSON.stringify(p.catalog.all());
  await expect(p.translateTheme(status=>{if(status.startsWith('正在汉化主题'))p.cancel();})).rejects.toThrow('已取消');
  expect(JSON.stringify(p.catalog.all())).toBe(stable);
  await expect(p.translateTheme(status=>{if(status.startsWith('正在汉化主题'))source+='\n';})).rejects.toThrow('发生变化');
  expect(JSON.stringify(p.catalog.all())).toBe(stable);
 }finally{p.onunload();root.remove();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;vi.mocked(requestUrl).mockReset();}
});
