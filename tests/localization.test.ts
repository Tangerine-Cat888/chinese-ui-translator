// @vitest-environment jsdom
import {test,expect} from 'vitest';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {Catalog,type Pack} from '../src/catalog';
import {extractLabels} from '../src/scanner';
import {LocalUi} from '../src/local-ui';
import {detectInterfaceLanguage} from '../src/language';
const base=resolve('tests/artifacts','catalog-'+Date.now());
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
