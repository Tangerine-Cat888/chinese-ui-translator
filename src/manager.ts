import {Plugin,PluginSettingTab,Setting,Notice,type PluginManifest,type SettingDefinitionItem} from 'obsidian';
import {createHash} from 'node:crypto';
import {Engine,type Config,type Transport} from './core';
import {SettingsStore} from './storage';
import {Catalog} from './catalog';
import {extractLabels} from './scanner';
import {LocalUi} from './local-ui';
import {detectInterfaceLanguage,type LanguageResult} from './language';
import {defaultClock,type Clock} from './clock';
import {services,serviceTransport,engineConfig,listServiceModels,type ServiceId,type ServiceProfile} from './services';
import {defaults as preferenceDefaults,loadPreferences,profileFor,type Preferences} from './preferences';

interface Settings extends Config {uiEnabled:boolean;rememberApiKey:boolean;excludedPlugins:string}
const defaults:Settings={endpoint:'',model:'',apiKey:'',language:'简体中文',online:false,glossary:{},uiEnabled:true,rememberApiKey:false,excludedPlugins:''};
interface Internals {setting?:{activeTab?:{id:string;containerEl:HTMLElement};modalEl?:HTMLElement;open?:()=>void;close?:()=>void;openTabById?:(id:string)=>void};plugins:{manifests:Record<string,PluginManifest & {dir?:string}>;enabledPlugins?:Set<string>};}
export default class TranslationManager extends Plugin {
 settings:Settings={...defaults};store!:SettingsStore;catalog!:Catalog;
 preferences:Preferences=preferenceDefaults();serviceBusy=false;private preferencesReady=false;
 busyId='';progress='';private job?:AbortController;private closed=false;private stopped=false;
 private serviceJobs=new Set<AbortController>();
 private docs=new Map<Document,MutationObserver>();private sessions=new Map<HTMLElement,{id:string;session:LocalUi}>();private hooks:(()=>void)[]=[];private timer?:()=>void;
 private clock:Clock=defaultClock;
 private status?:HTMLElement;private tab!:ManagerSettings;private catalogReady=false;
 private languages=new Map<string,Promise<LanguageResult>>();
 private get host(){return this.app as unknown as Internals;}
 manifests(){return Object.values(this.host.plugins.manifests).filter(m=>m.id!==this.manifest.id&&m.id!=='bilingual-assistant').sort((a,b)=>a.name.localeCompare(b.name));}
 names(){return new Set(this.manifests().flatMap(m=>[m.name,m.id]));}
 async englishPlugins(){
  const manifests=this.manifests(),names=this.names();const visible:typeof manifests=[];let chinese=0,unknown=0;
  for(const manifest of manifests){
   if(this.stopped)break;
   if(this.catalog.get(manifest.id,this.settings.language)){visible.push(manifest);continue;}
   const key=manifest.id+'@'+manifest.version;
   let job=this.languages.get(key);if(!job){job=(async()=>{try{const source=await this.app.vault.adapter.read(`${manifest.dir||`${this.app.vault.configDir}/plugins/${manifest.id}`}/main.js`);return await detectInterfaceLanguage(source,names);}catch{return {kind:'unknown',english:0,chinese:0};}})();this.languages.set(key,job);}
   const result=await job;if(result.kind==='english')visible.push(manifest);else if(result.kind==='chinese')chinese++;else unknown++;
  }
  return {visible,chinese,unknown};
 }
 async onload(){
  if(this.manifest.id==='chinese-ui-translator'&&this.host.plugins.enabledPlugins?.has('bilingual-assistant')){
   new Notice('请先停用旧版 bilingual-assistant，再启用 Chinese UI Translator；旧配置和词典会自动迁移。');
   throw new Error('旧版汉化插件仍启用，已停止加载以避免重复修改界面');
  }
  this.store=new SettingsStore((this.app.vault.adapter as unknown as {getBasePath():string}).getBasePath());
  this.catalog=new Catalog(this.store.directory);
  try{this.preferences=await loadPreferences(this,()=>this.store.load(),async()=>{
   if(this.manifest.id!=='chinese-ui-translator')return null;
   const oldPath=`${this.app.vault.configDir}/plugins/bilingual-assistant/data.json`;
   return await this.app.vault.adapter.exists(oldPath)?JSON.parse(await this.app.vault.adapter.read(oldPath)) as unknown:null;
  });this.preferencesReady=true;this.syncSettings();}catch(e){new Notice((e as Error).message);}
  try{await this.catalog.load();this.catalogReady=true;}catch{new Notice('汉化词典读取失败，已保留文件，暂停词典写入');}
  // Migration deliberately disables the old automatic-network mode.
  this.settings.online=false;
  this.tab=new ManagerSettings(this);this.addSettingTab(this.tab);
  this.status=this.addStatusBarItem();this.updateStatus();this.status.onclick=()=>{this.host.setting?.open?.();this.host.setting?.openTabById?.(this.manifest.id);};
  this.addCommand({id:'manage-translations',name:'管理插件汉化',callback:()=>this.status?.click()});
  this.addCommand({id:'toggle-ui',name:'暂停／恢复已保存汉化',callback:()=>{void this.applySettings({...this.settings,uiEnabled:!this.settings.uiEnabled}).catch((e:unknown)=>new Notice(e instanceof Error?e.message:String(e)));}});
  this.watchLifecycle();
  this.registerEvent(this.app.workspace.on('layout-change',()=>this.schedule()));
  this.registerEvent(this.app.workspace.on('window-open',(_leaf,win)=>{this.watch(win.document);this.schedule();}));
  this.registerEvent(this.app.workspace.on('window-close',(_leaf,win)=>this.release(win.document)));
  // The main document anchors lifecycle tracking; every popout is registered separately.
  this.app.workspace.onLayoutReady(()=>{if(!this.stopped){this.watch(this.app.workspace.containerEl.ownerDocument);this.refresh();}});
 }
 private watchLifecycle(){
  const setting=this.host.setting;if(!setting)return;
  // Wrapper must preserve the host method's dynamic this while retaining its plugin owner.
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- Preserve the host method dynamic receiver and plugin owner separately.
  const owner=this;
  for(const name of ['open','close','openTabById'] as const){const original=setting[name];if(typeof original!=='function')continue;
   const wrapped=function(this:unknown,...args:unknown[]){
    // Compare against the main document, never the active popout being closed.
      if(name==='close'){owner.closed=true;const doc=setting.activeTab?.containerEl?.ownerDocument||setting.modalEl?.ownerDocument;if(doc&&doc!==owner.app.workspace.containerEl.ownerDocument)owner.release(doc);else owner.stopSessions();}
    const result:unknown=Reflect.apply(original,this,args);if(name==='open')owner.closed=false;owner.schedule();return result;
   };
   (setting as Record<string,unknown>)[name]=wrapped;this.hooks.push(()=>{if(setting[name]===wrapped)(setting as Record<string,unknown>)[name]=original;});
  }
 }
 private watch(doc:Document){if(this.docs.has(doc)||!doc.defaultView)return;const observer=new doc.defaultView.MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1)))this.schedule();});observer.observe(doc.body,{childList:true,subtree:true});this.docs.set(doc,observer);}
 private release(doc:Document){for(const [root,record] of this.sessions)if(root.ownerDocument===doc){record.session.stop();this.sessions.delete(root);}this.docs.get(doc)?.disconnect();this.docs.delete(doc);}
 private schedule(){if(this.stopped||this.timer)return;this.timer=this.clock.set(()=>{this.timer=undefined;this.refresh();},100);}
 private stopSessions(){this.sessions.forEach(r=>r.session.stop());this.sessions.clear();}
 refresh(){
  if(this.stopped)return;
  const roots=new Map<HTMLElement,string>();const tab=this.host.setting?.activeTab;
  if(!this.closed&&tab?.containerEl?.isConnected){this.watch(tab.containerEl.ownerDocument);if(tab.id!==this.manifest.id&&this.host.plugins.manifests[tab.id])roots.set(tab.containerEl,tab.id);}
  this.app.workspace.iterateAllLeaves(leaf=>this.watch(leaf.view.containerEl.ownerDocument));
  for(const doc of this.docs.keys()){
   doc.querySelectorAll<HTMLElement>('.menu:not(.suggestion-container)').forEach(root=>roots.set(root,''));
   // Only explicit controls in custom plugin views; never Markdown or file titles.
   const builtin=new Set(['markdown','file-explorer','search','backlink','outgoing-link','tag','outline','canvas','graph','localgraph','bookmarks','empty','pdf','image','audio','video']);
   doc.querySelectorAll<HTMLElement>('.workspace-leaf-content[data-type]').forEach(root=>{if(!builtin.has(root.dataset.type||''))roots.set(root,'');});
  }
  if(!this.settings.uiEnabled)roots.clear();
  const names=this.names(),installed=new Set(this.manifests().map(m=>m.id));
  for(const [root,record] of this.sessions)if(!root.isConnected||!roots.has(root)||roots.get(root)!==record.id){record.session.stop();this.sessions.delete(root);}
  for(const [root,id] of roots)if(!this.sessions.has(root))this.sessions.set(root,{id,session:new LocalUi(root,text=>this.catalog.lookup(text,this.settings.language,id||undefined,names,installed),this.clock)});
  this.updateStatus();
 }
 private updateStatus(){if(this.status)this.status.textContent=this.busyId?'插件汉化：处理中':this.settings.uiEnabled?'插件汉化：已开启':'插件汉化：已暂停';}
 private syncSettings(){const p=profileFor(this.preferences);let endpoint='';try{endpoint=engineConfig(this.preferences.serviceId,p).endpoint;}catch{/* An incomplete draft has no usable endpoint yet. */}this.settings={...this.settings,uiEnabled:this.preferences.uiEnabled,apiKey:p.apiKey,endpoint,model:services[this.preferences.serviceId].kind==='ai'?p.model:this.preferences.serviceId,language:'简体中文',online:false};}
 private async persist(preferences:Preferences){if(!this.preferencesReady)throw new Error('配置未成功读取，暂不覆盖原文件');await this.saveData(preferences);this.preferences=preferences;this.syncSettings();}
 async applySettings(settings:Settings){if(this.busyId||this.serviceBusy)throw new Error('请先等待当前任务完成');await this.persist({...this.preferences,uiEnabled:settings.uiEnabled});this.stopSessions();this.refresh();}
 async saveService(id:ServiceId,profile:ServiceProfile){if(this.busyId)throw new Error('请先等待汉化完成');await this.persist({...this.preferences,serviceId:id,profiles:{...this.preferences.profiles,[id]:{...profile}}});}
 async setEnabled(id:string,enabled:boolean){if(!this.catalogReady)throw new Error('词典尚未正常加载');if(this.busyId)throw new Error('请先等待当前汉化完成');const pack=this.catalog.get(id,this.settings.language);if(!pack)return;await this.catalog.save({...pack,enabled});this.stopSessions();this.refresh();}
 cancel(){this.job?.abort();}
 private transport():Transport{return serviceTransport(this.preferences.serviceId,profileFor(this.preferences));}
 async fetchModels(id:ServiceId,profile:ServiceProfile){if(this.stopped)throw new Error('插件已卸载');const controller=new AbortController();this.serviceJobs.add(controller);try{return await listServiceModels(id,profile,controller.signal);}finally{this.serviceJobs.delete(controller);}}
 async testService(id:ServiceId,profile:ServiceProfile){if(this.stopped)throw new Error('插件已卸载');const config=engineConfig(id,profile);const engine=new Engine(config,serviceTransport(id,profile),this.clock);const controller=new AbortController();this.serviceJobs.add(controller);try{return await engine.translate({scope:'ui',text:'The connection works.',context:'Connection test'},controller.signal);}finally{engine.dispose();this.serviceJobs.delete(controller);}}
 async translatePlugin(id:string,onProgress:(s:string)=>void=()=>{}){
  if(this.busyId||this.serviceBusy)throw new Error('已有任务正在进行');if(!this.catalogReady)throw new Error('词典尚未正常加载');if(!this.preferencesReady)throw new Error('请先检查配置文件');
  const manifest=this.host.plugins.manifests[id];if(!manifest||id===this.manifest.id)throw new Error('未找到目标插件');
  if(!this.settings.endpoint||!this.settings.model)throw new Error('请先保存翻译服务地址和模型');
  const config={...this.settings,online:true,glossary:{...this.settings.glossary}};const language=config.language;const abort=new AbortController();this.job=abort;this.busyId=id;this.updateStatus();
  const report=(s:string)=>{this.progress=s;onProgress(s);};let engine:Engine|undefined;
  try{
   report('正在扫描插件界面词条…');
   const path=`${manifest.dir||`${this.app.vault.configDir}/plugins/${id}`}/main.js`;
   const source=await this.app.vault.adapter.read(path);const hash=createHash('sha256').update(source).digest('hex');
   const labels=await extractLabels(source,this.names(),abort.signal);const previous=this.catalog.get(id,language);
   const strings=Object.fromEntries(labels.filter(s=>previous&&Object.hasOwn(previous.strings,s)).map(s=>[s,previous!.strings[s]]));
   const missing=labels.filter(s=>!Object.hasOwn(strings,s));
   if(!labels.length)throw new Error('没有识别到可翻译的英文静态词条；此插件可能使用动态文本');
   engine=new Engine(config,this.transport(),this.clock);
   for(let i=0;i<missing.length;i+=12){
    if(abort.signal.aborted)throw new Error('已取消，原汉化词典未改变');report(`正在汉化 ${Math.min(i+12,missing.length)}/${missing.length} 条新增词条`);
    const batch=missing.slice(i,i+12);const values=await Promise.all(batch.map(text=>engine!.translate({scope:'ui',text,context:`Plugin interface: ${id}; keep product names unchanged`},abort.signal)));
    batch.forEach((text,j)=>{strings[text]=values[j];});
   }
   if(abort.signal.aborted||this.stopped)throw new Error('已取消，原汉化词典未改变');
   const currentSource=await this.app.vault.adapter.read(path);if(createHash('sha256').update(currentSource).digest('hex')!==hash)throw new Error('插件代码在汉化期间发生变化，请重新汉化');
   if(abort.signal.aborted||this.stopped)throw new Error('已取消，原汉化词典未改变');
   await this.catalog.save({pluginId:id,version:manifest.version,sourceHash:hash,language,enabled:true,updatedAt:new Date().toISOString(),strings});
   this.stopSessions();this.refresh();report(`已保存 ${labels.length} 条；新增翻译 ${missing.length} 条`);return {total:labels.length,translated:missing.length};
  }finally{engine?.dispose();this.busyId='';this.job=undefined;this.updateStatus();if(!this.stopped&&this.host.setting?.activeTab?.id===this.manifest.id&&this.tab.containerEl?.isConnected)this.tab.update();}
 }
 onunload(){this.stopped=true;this.job?.abort();this.serviceJobs.forEach(c=>c.abort());this.serviceJobs.clear();this.timer?.();this.docs.forEach(o=>o.disconnect());this.docs.clear();this.stopSessions();this.hooks.forEach(f=>f());}
}

class ManagerSettings extends PluginSettingTab {
 private opened=new Map<string,boolean>();
 private query='';
 private selected?:ServiceId;
 private drafts=new Map<ServiceId,ServiceProfile>();
 private models=new Map<ServiceId,string[]>();
 private manual=new Set<ServiceId>();
 constructor(private manager:TranslationManager){super(manager.app,manager);}
 private section(el:HTMLElement,id:string,title:string,description:string,initial=false){
  const details=el.createEl('details',{cls:'ba-settings-section'});details.open=this.opened.get(id)??initial;
  const summary=details.createEl('summary');const label=summary.createSpan({cls:'ba-section-label'});
  label.createSpan({cls:'ba-section-title',text:title});
  const caption=label.createSpan({cls:'ba-section-description',text:description});
  details.addEventListener('toggle',()=>{this.opened.set(id,details.open);});
  summary.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();details.open=event.key==='ArrowRight';this.opened.set(id,details.open);}});
  return {details,caption,body:details.createDiv({cls:'ba-section-body'})};
 }
 getSettingDefinitions():SettingDefinitionItem[]{
  return [{name:'插件汉化管理',aliases:['翻译服务','API Key','模型','DeepSeek','OpenAI','DeepL','词典'],render:setting=>{setting.settingEl.empty();setting.settingEl.addClass('ba-custom-settings');setting.settingEl.parentElement?.classList.add('ba-settings-container');this.renderSettings(setting.settingEl);}}];
 }
 private renderSettings(el:HTMLElement){
  const p=this.manager;el.empty();el.dataset.baIgnore='';el.addClass('ba-settings');
  const intro=el.createDiv({cls:'ba-settings-intro'});new Setting(intro).setName('插件汉化管理').setHeading();intro.createEl('p',{text:'配置翻译服务，按需汉化插件界面。'});
  const status=el.createDiv({cls:'ba-settings-status'});
  new Setting(status).setName('显示已保存的中文').setDesc('随时切换中英文，已保存的词典会保留。').addToggle(t=>t.setValue(p.settings.uiEnabled).onChange(async value=>{try{await p.applySettings({...p.settings,uiEnabled:value});}catch(e){new Notice((e as Error).message);this.update();}}));
  new Setting(el).setName('翻译配置').setHeading();this.serviceSettings(el);
  new Setting(el).setName('插件与词典').setHeading();
  const plugins=this.section(el,'plugins','插件汉化','查找英文插件，生成或管理已保存的中文词典。',true);
  const search=new Setting(plugins.body).setName('查找插件');const summary=plugins.body.createEl('p',{cls:'ba-list-summary',text:'正在本地识别插件界面语言…'});summary.setAttribute('aria-live','polite');const list=plugins.body.createDiv({cls:'ba-plugin-list'});
  let candidates=p.manifests().filter(m=>p.catalog.get(m.id,p.settings.language));let ready=false;
  const render=()=>{
   list.empty();const matching=candidates.filter(m=>(m.name+' '+m.id).toLowerCase().includes(this.query.toLowerCase()));
   if(ready&&!matching.length)list.createEl('p',{cls:'ba-empty',text:this.query?'没有匹配的插件，试试其他名称。':'没有检测到需要汉化的英文插件。'});
   for(const manifest of matching){
    const pack=p.catalog.get(manifest.id,p.settings.language);const count=pack?Object.keys(pack.strings).length:0;
    const desc=p.busyId===manifest.id?p.progress:!pack?'未汉化':`${pack.enabled?'中文已启用':'已恢复英文'} · 已保存 ${count} 条${pack.version!==manifest.version?' · 插件版本变化，可补翻':''}`;
    const row=new Setting(list).setName(manifest.name).setDesc(desc);
    row.addButton(b=>b.setButtonText(pack?'补翻新增':'汉化').setDisabled(!!p.busyId).onClick(async()=>{
     const result=p.translatePlugin(manifest.id,()=>render());render();
     try{const r=await result;new Notice(`${manifest.name}：已保存 ${r.total} 条，新增翻译 ${r.translated} 条`);}catch(e){new Notice((e as Error).message);}finally{render();}
    }));
    if(pack)row.addButton(b=>b.setButtonText(pack.enabled?'恢复英文':'启用中文').setDisabled(!!p.busyId).onClick(async()=>{try{await p.setEnabled(manifest.id,!pack.enabled);render();}catch(e){new Notice((e as Error).message);}}));
   }
   if(p.busyId)new Setting(list).setName('汉化进行中').setDesc(p.progress).addButton(b=>b.setButtonText('取消').onClick(()=>p.cancel()));
  };
  search.addText(t=>t.setPlaceholder('插件名称或 ID').setValue(this.query).onChange(v=>{this.query=v;render();}));render();
  void p.englishPlugins().then(result=>{if(!summary.isConnected)return;candidates=result.visible;ready=true;summary.textContent=`显示 ${candidates.length} 个英文或已汉化插件；已隐藏 ${result.chinese} 个中文或内置中文支持的插件${result.unknown?`，${result.unknown} 个未能确定语言`:''}。识别只在本地进行。`;render();});
  const help=this.section(el,'help','使用说明','了解汉化范围、词典保存与原文保护。');
  help.body.createEl('p',{text:'点击“汉化”后才会请求翻译服务。译文保存在本机，之后打开界面直接应用。插件名字、笔记和插件文件保持原样。'});
  help.body.createEl('p',{text:'可识别的静态英文词条会保存为词典；运行时拼接文本、图片内文字可能无法覆盖。菜单按已保存原文精确匹配，存在歧义时保留英文。'});
 }
 private serviceSettings(el:HTMLElement){
  const p=this.manager;let selected=this.selected??p.preferences.serviceId;
  const {drafts,models,manual}=this;
  const {caption:summary,body}=this.section(el,'service','翻译服务',`当前服务：${services[p.preferences.serviceId].name}`,!profileFor(p.preferences).apiKey);
  const form=body.createDiv();const feedback=body.createEl('p',{cls:'ba-service-feedback'});feedback.setAttribute('aria-live','polite');
  body.createEl('p',{cls:'ba-settings-note',text:'密钥随本插件配置保存在库内 data.json。清空密钥后保存即可清除；已保存的汉化词典不受切换服务影响。'});
  const render=()=>{
   form.empty();const id=selected;let draft=drafts.get(id);if(!draft){draft=profileFor(p.preferences,id);drafts.set(id,draft);}const profile=draft;
   new Setting(form).setName('翻译服务').addDropdown(d=>{d.addOptions(Object.fromEntries(Object.entries(services).map(([key,s])=>[key,s.name]))).setValue(id).setDisabled(p.serviceBusy).onChange(value=>{selected=value as ServiceId;this.selected=selected;feedback.textContent='';render();});});
   new Setting(form).setName(id==='deeplx'?'访问密钥（可选）':'API Key').addText(t=>{t.inputEl.type='password';t.setValue(profile.apiKey).onChange(v=>profile.apiKey=v.trim());t.setDisabled(p.serviceBusy);});
   if(id==='deepl')new Setting(form).setName('账户类型').addDropdown(d=>d.addOptions({free:'DeepL API Free',pro:'DeepL API Pro'}).setValue(profile.plan).setDisabled(p.serviceBusy).onChange(v=>profile.plan=v as 'free'|'pro'));
   if(id==='custom'||id==='deeplx')new Setting(form).setName('服务地址').setDesc(id==='deeplx'?'你的 DeepLX 实例地址':'兼容 OpenAI 的服务地址，可填写完整接口地址').addText(t=>t.setValue(profile.baseUrl).setDisabled(p.serviceBusy).onChange(v=>profile.baseUrl=v.trim()));
   if(services[id].kind==='ai'){
    const choices=models.get(id)||[];const row=new Setting(form).setName('模型');
    if(choices.length&&!manual.has(id))row.addDropdown(d=>{const all=Array.from(new Set([profile.model,...choices].filter(Boolean)));if(!profile.model)d.addOption('','请选择模型');all.forEach(model=>{d.addOption(model,model);});d.addOption('__manual__','手动填写…').setValue(profile.model).setDisabled(p.serviceBusy).onChange(value=>{if(value==='__manual__'){manual.add(id);render();}else profile.model=value;});});
    else row.addText(t=>t.setValue(profile.model).setPlaceholder('模型名称').setDisabled(p.serviceBusy).onChange(v=>profile.model=v.trim()));
    row.addButton(b=>b.setButtonText('获取模型').setDisabled(p.serviceBusy||!!p.busyId).onClick(async()=>{
     p.serviceBusy=true;feedback.textContent='正在获取模型…';render();
     try{const found=await p.fetchModels(id,{...profile});models.set(id,found);manual.delete(id);feedback.textContent=found.length?`已获取 ${found.length} 个模型`:'服务没有返回模型，可手动填写';}catch(e){feedback.textContent=(e as Error).message;}finally{p.serviceBusy=false;render();}
    }));
    if(id!=='custom')new Setting(form).setName('服务地址').setDesc('已预填官方地址，通常无需修改').addText(t=>t.setValue(profile.baseUrl).setDisabled(p.serviceBusy).onChange(v=>profile.baseUrl=v.trim()));
   }
   new Setting(form).setName('配置').addButton(b=>b.setButtonText('保存并测试').setCta().setDisabled(p.serviceBusy||!!p.busyId).onClick(async()=>{
    p.serviceBusy=true;feedback.textContent='正在保存…';render();let saved=false;
    try{
     await p.saveService(id,{...profile});saved=true;summary.textContent=`当前服务：${services[id].name}`;
     if(!profile.apiKey&&id!=='custom'&&id!=='deeplx'){feedback.textContent='已清除该服务的密钥，已保存的汉化仍可使用';return;}
     feedback.textContent='配置已保存，正在测试真实翻译…';const result=await p.testService(id,{...profile});feedback.textContent=`已保存，测试成功：${result}`;
    }catch(e){feedback.textContent=`${saved?'配置已保存，但测试失败':'保存失败'}：${(e as Error).message}`;}finally{p.serviceBusy=false;render();}
   }));
  };render();
 }
}
