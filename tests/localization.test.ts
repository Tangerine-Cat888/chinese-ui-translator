// @vitest-environment jsdom
import {test,expect} from 'vitest';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {Catalog,type Pack} from '../src/catalog';
import {extractLabels} from '../src/scanner';
import {LocalUi,collectUiLabels} from '../src/local-ui';
import {detectInterfaceLanguage} from '../src/language';
import {settingsLabels} from '../src/settings-adapters';
const base=resolve('tests/artifacts','catalog-'+Date.now());
test('Copilot settings adapter translates custom labels, keeps controls and restores original text',()=>{
 const root=document.createElement('div');
 root.innerHTML='<div class="tw-text-sm tw-font-medium tw-leading-none">Default agent</div><div class="tw-text-xs tw-text-muted">Choose <strong>your agent</strong></div><div class="tw-text-xl tw-font-bold tw-text-normal">Bring your own key</div><div class="tw-text-xs tw-text-muted"><input value="Default agent"><textarea>Default agent</textarea><code>Default agent</code><div contenteditable="true">Default agent</div><div class="markdown-rendered">Default agent</div></div><div>Default agent</div>';
 const original=root.innerHTML,strong=root.querySelector('strong'),input=root.querySelector('input');
 const dictionary:Record<string,string>={'Default agent':'默认智能体','Choose your agent':'选择你的智能体','Bring your own key':'自带密钥'};
 const lookup=(text:string)=>dictionary[text];
 const plain=new LocalUi(root,lookup);expect(root.innerHTML).toBe(original);plain.stop();
 expect(settingsLabels('other-plugin')).toBe('');
 const session=new LocalUi(root,lookup,undefined,settingsLabels('copilot'));
 expect(root.firstElementChild!.textContent).toBe('默认智能体');expect(strong).toBe(root.querySelector('strong'));expect(root.children[1].textContent).toBe('选择你的智能体');
 expect(root.children[2].textContent).toBe('自带密钥');expect(root.querySelector('input')).toBe(input);expect(input!.value).toBe('Default agent');
 for(const el of root.querySelectorAll('textarea,code,[contenteditable],.markdown-rendered'))expect(el.textContent).toBe('Default agent');
 expect(root.lastElementChild!.textContent).toBe('Default agent');
 expect(session.collect(new Set())).toContain('Choose your agent');expect(session.collect(new Set())).not.toContain('选择你的智能体');
 const added=document.createElement('div');added.className='tw-text-xs tw-text-muted';added.textContent='Default agent';root.append(added);session.scan();expect(added.textContent).toBe('默认智能体');added.remove();
 const link=document.createElement('a');link.className='tw-inline-flex tw-text-sm tw-text-accent';link.href='https://example.invalid';link.textContent='Default agent';root.append(link);session.scan();expect(link.textContent).toBe('默认智能体');expect(link.getAttribute('href')).toBe('https://example.invalid');link.remove();
 session.stop();expect(root.innerHTML).toBe(original);
});
test('large scans preserve every unique label and templates beyond 3000 entries',async()=>{
 const labels=Array.from({length:3001},(_,i)=>`Feature label ${i}`);
 const source=labels.map(text=>`x.setName(${JSON.stringify(text)});`).join('')+'x.setName("Feature label 0");x.setDesc(`Found ${count} results`);';
 expect(await extractLabels(source,new Set())).toEqual([...labels,'Found ⟦BA0⟧ results']);
 const controller=new AbortController();controller.abort();
 await expect(extractLabels(source,new Set(),controller.signal)).rejects.toThrow('已取消');
});
test('known display arguments include short, lowercase, mixed and static template labels without option IDs',async()=>{
 const source='x.setButtonText("OK"); x.setName("save"); x.setDesc("启用 API"); x.setTitle(`UI`); x.addOption("private_id", "PDF"); x.createEl("div",{text:"AI",cls:"secret"}); x.addOptions({raw:"on"}); const internal="raw";';
 expect(await extractLabels(source,new Set())).toEqual(['OK','save','启用 API','UI','PDF','AI','on']);
 expect((await detectInterfaceLanguage('x.setName("save");x.setButtonText("OK");',new Set())).kind).toBe('english');
});
test('split labels translate as a whole, preserve element identity, and restore original nodes',()=>{
 const root=document.createElement('div');document.body.append(root);
 root.innerHTML='<div class="setting-item-description">Enable <strong>cloud sync</strong></div><summary>Advanced options</summary><input value="private input" placeholder="API token"><div class="markdown-rendered"><button>Private note</button></div><option>Implicit value</option>';
 const original=root.innerHTML,strong=root.querySelector('strong');
 const candidates=collectUiLabels(root,new Set());
 expect(candidates).toContain('Enable cloud sync');expect(candidates).toContain('API token');
 expect(candidates).not.toContain('private input');expect(candidates).not.toContain('Private note');expect(candidates).not.toContain('Implicit value');
 const session=new LocalUi(root,text=>text==='Enable cloud sync'?'启用云同步':text==='Advanced options'?'高级选项':undefined);
 expect(root.querySelector('.setting-item-description')!.textContent).toBe('启用云同步');expect(root.querySelector('strong')).toBe(strong);
 session.scan();expect(session.collect(new Set())).toContain('Enable cloud sync');expect(session.collect(new Set())).not.toContain('启用云同步');
 session.stop();expect(root.innerHTML).toBe(original);root.remove();
});
test('host changes to a split label release remaining patches without overwriting the new text',()=>{
 const root=document.createElement('div');root.innerHTML='<button>Enable <strong>sync</strong></button>';
 const session=new LocalUi(root,text=>text==='Enable sync'?'启用同步':undefined);
 root.querySelector('strong')!.textContent='backup';session.scan();
 expect(root.textContent).toBe('Enable backup');session.stop();expect(root.textContent).toBe('Enable backup');
});
test('option labels without explicit values keep their original submitted value',()=>{
 const root=document.createElement('div');document.body.append(root);
 root.innerHTML='<select><option>Open dashboard</option><option value="explicit">Open dashboard</option></select>';
 const session=new LocalUi(root,()=> '打开面板');
 const options=root.querySelectorAll('option');
 expect(options[0].value).toBe('Open dashboard');expect(options[0].textContent).toBe('Open dashboard');
 expect(options[1].value).toBe('explicit');expect(options[1].textContent).toBe('打开面板');
 session.stop();root.remove();
});
const pack=(id:string,strings:Record<string,string>):Pack=>({pluginId:id,language:'简体中文',enabled:true,strings,version:'1',sourceHash:'abc',updatedAt:'now'});
test('Chinese interfaces with English plugin names and diagnostic messages are hidden',async()=>{
 const result=await detectInterfaceLanguage('const name="English Plugin";x.setName("启用功能");x.setDesc("设置说明");console.error("Unable to load file");console.log("Connection failed");',new Set(['English Plugin']));
 expect(result.kind).toBe('chinese');
});
test('English interfaces are detected independently of plugin names',async()=>{
 expect((await detectInterfaceLanguage('x.setName("Enable feature");x.setDesc("Choose a folder");',new Set())).kind).toBe('english');
});
test('bundled Chinese language packs are not treated as needing translation because of English fallback strings',async()=>{
 const source='x.setName("Enable feature");x.setDesc("Choose a folder");const zh='+JSON.stringify(Array.from({length:10},(_,i)=>'中文界面词条'+i))+';';
 expect((await detectInterfaceLanguage(source,new Set())).kind).toBe('chinese');
});
test('source scanning never executes code and omits plugin names, code identifiers and dynamic templates',async()=>{
 (globalThis as any).scannerExecuted=false;
 const strings=await extractLabels('globalThis.scannerExecuted=true; x.setName("Enable feature"); x.setTitle("Open dashboard"); const x="Calendar";const y="internal-css-class";const z=`Static label`;const a=`Hello ${name}`;',new Set(['Calendar']));
 expect((globalThis as any).scannerExecuted).toBe(false);
 expect(strings).toEqual(['Enable feature','Open dashboard','Static label']);
});
test('saved packs reload and can be disabled without losing the dictionary; ambiguous menus stay original',async()=>{
 const c=new Catalog(base);await c.save(pack('one',{'Open dashboard':'打开仪表盘','Calendar':'日历'}));
 const fresh=new Catalog(base);await fresh.load();
 const names=new Set(['Calendar']),installed=new Set(['one','two']);
 expect(fresh.lookup('Open dashboard','简体中文','one',names,installed)).toBe('打开仪表盘');
 expect(fresh.lookup('Calendar','简体中文','one',names,installed)).toBeUndefined();
 await fresh.save(pack('two',{'Open dashboard':'打开面板'}));
 expect(fresh.lookup('Open dashboard','简体中文',undefined,names,installed)).toBeUndefined();
 await fresh.save({...fresh.get('one','简体中文')!,enabled:false});
 expect(fresh.lookup('Open dashboard','简体中文','one',names,installed)).toBeUndefined();
 expect(fresh.get('one','简体中文')!.strings['Open dashboard']).toBe('打开仪表盘');
 expect(await readFile(base+'/translations.json','utf8')).not.toContain('apiKey');
});
test('offline overlay handles settings, menu, option labels and tooltips without changing names, values, or note text',()=>{
 const root=document.createElement('div');document.body.append(root);
 root.innerHTML='<h2>Calendar</h2><div class="setting-item-name">Open dashboard</div><div class="menu-item-title">Open dashboard</div><select><option value="Open dashboard">Open dashboard</option></select><input value="Open dashboard" placeholder="Open dashboard"><button title="Open dashboard">Open dashboard</button><div class="markdown-preview-view"><h2>Open dashboard</h2></div>';
 const original=root.innerHTML;const s=new LocalUi(root,text=>text==='Open dashboard'?'打开面板':undefined);
 expect(root.querySelector('.menu-item-title')!.textContent).toBe('打开面板');
 expect(root.querySelector('h2')!.textContent).toBe('Calendar');expect(root.querySelector('input')!.value).toBe('Open dashboard');
 expect(root.querySelector('input')!.placeholder).toBe('打开面板');expect(root.querySelector('option')!.value).toBe('Open dashboard');
 expect(root.querySelector('.markdown-preview-view')!.textContent).toBe('Open dashboard');
 s.stop();expect(root.innerHTML).toBe(original);root.remove();
});
