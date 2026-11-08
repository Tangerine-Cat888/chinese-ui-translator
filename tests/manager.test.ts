// @vitest-environment jsdom
import {test,expect,vi} from 'vitest';
import {resolve} from 'node:path';
vi.mock('obsidian',()=>({
 Plugin:class{app:any;manifest:any;constructor(app:any,manifest:any){this.app=app;this.manifest=manifest;}async loadData(){return this.app.savedData??null;}async saveData(value:unknown){this.app.savedData=structuredClone(value);}addStatusBarItem(){return document.createElement('div');}addSettingTab(){}addCommand(){}registerEvent(){}},
 PluginSettingTab:class{},Setting:class{},Notice:class{},requestUrl:vi.fn()
}));
import Manager from '../src/manager';import {requestUrl} from 'obsidian';
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
 }finally{p.onunload();root.remove();if(old===undefined)delete process.env.APPDATA;else process.env.APPDATA=old;}
});
