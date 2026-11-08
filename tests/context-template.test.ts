// @vitest-environment jsdom
import {test,expect,vi} from 'vitest';
import {resolve} from 'node:path';
import {Catalog,type Pack} from '../src/catalog';
import {extractLabels} from '../src/scanner';
import {numericValues,renderNumeric,templateSource} from '../src/numeric-template';
import {LocalUi} from '../src/local-ui';
import {viewOwner} from '../src/ui-context';
const pack=(pluginId:string,strings:Record<string,string>,contexts?:Pack['contexts']):Pack=>({pluginId,strings,contexts,language:'简体中文',version:'1',sourceHash:'test',updatedAt:'now',enabled:true});
test('numeric templates are extracted only from UI calls and never execute expressions',async()=>{
 const result=await extractLabels('x.setDesc(`Found ${count} results`);x.createEl("span",{text:`Loaded ${items.length} records`});x.setDesc(`Run ${execute()} tasks`);const privateMessage=`Hello ${name}`;x.setName(`v${major}.${minor}`);',new Set());
 expect(result).toContain('Found ⟦BA0⟧ results');expect(result).toContain('Loaded ⟦BA0⟧ records');
 expect(result.some(s=>s.startsWith('Run ')||s.startsWith('Hello ')||s.startsWith('v⟦'))).toBe(false);
});
test('numeric patterns are anchored, escaped and bounded; placeholders must survive exactly',()=>{
 expect(renderNumeric('Found ⟦BA0⟧ results','找到 ⟦BA0⟧ 个结果','Found 12 results')).toBe('找到 12 个结果');
 expect(renderNumeric('Processed ⟦BA0⟧ of ⟦BA1⟧ items','共 ⟦BA1⟧ 项，已完成 ⟦BA0⟧ 项','Processed 3 of 20 items')).toBe('共 20 项，已完成 3 项');
 for(const text of ['Found Alice results','prefix Found 3 results','Found 3 results suffix','Found 1234567890123 results'])expect(numericValues('Found ⟦BA0⟧ results',text)).toBeUndefined();
 expect(renderNumeric('Found ⟦BA0⟧ results','找到结果','Found 3 results')).toBeUndefined();
 expect(renderNumeric('Found ⟦BA0⟧ results','⟦BA0⟧ ⟦BA0⟧','Found 3 results')).toBeUndefined();
 expect(numericValues('Found (⟦BA0⟧) results.','Found (3) results.')).toEqual(['3']);
 expect(numericValues('Found (⟦BA0⟧) results.','Found 3 resultsX')).toBeUndefined();
 expect(templateSource('Found 3 results',['Found ⟦BA0⟧ results'])).toBe('Found ⟦BA0⟧ results');
});
test('context dictionaries survive reload and resolve same-word roles without guessing an unknown role',async()=>{
 const directory=resolve('tests/artifacts','contexts-'+Date.now());const c=new Catalog(directory);
 await c.save(pack('one',{Open:'打开'},{action:{Open:'打开'},description:{Open:'开启状态'}}));
 await c.save(pack('two',{Open:'展开'}));const fresh=new Catalog(directory);await fresh.load();
 const lookup=(id:string|undefined,role?:string)=>fresh.lookup('Open','简体中文',id,new Set(),new Set(['one','two']),role);
 expect(lookup('one','action')).toBe('打开');expect(lookup('one','description')).toBe('开启状态');
 expect(lookup('one','heading')).toBeUndefined();expect(lookup(undefined,'action')).toBeUndefined();expect(lookup('two','action')).toBe('展开');
});
test('numeric templates stay local to their owner, prefer exact entries, and reject conflicting matches',async()=>{
 const c=new Catalog(resolve('tests/artifacts','numeric-'+Date.now()));
 await c.save(pack('one',{'Found ⟦BA0⟧ results':'找到 ⟦BA0⟧ 个结果','Found 1 results':'找到一个结果'}));
 const lookup=(text:string,id:string|undefined='one')=>c.lookup(text,'简体中文',id,new Set(),new Set(['one']),'description');
 expect(lookup('Found 12 results')).toBe('找到 12 个结果');expect(lookup('Found 1 results')).toBe('找到一个结果');
 expect(c.lookup('Found 12 results','简体中文',undefined,new Set(),new Set(['one']))).toBeUndefined();
 await c.save(pack('one',{'Found ⟦BA0⟧ results':'找到 ⟦BA0⟧ 个结果'},{action:{'Found ⟦BA0⟧ results':'显示 ⟦BA0⟧ 个结果'},description:{'Found ⟦BA0⟧ results':'共 ⟦BA0⟧ 个结果'}}));
 expect(c.lookup('Found 12 results','简体中文','one',new Set(),new Set(['one']),'heading')).toBeUndefined();
});
test('numeric DOM labels follow host updates and restore the latest number without changing input values',()=>{
 const root=document.createElement('div');root.innerHTML='<div class="setting-item-description">Found 3 results</div><input value="Found 3 results">';
 const session=new LocalUi(root,(text,role)=>role==='description'?renderNumeric('Found ⟦BA0⟧ results','找到 ⟦BA0⟧ 个结果',text):undefined);
 const label=root.querySelector('.setting-item-description')!;expect(label.textContent).toBe('找到 3 个结果');
 label.textContent='Found 15 results';session.scan();expect(label.textContent).toBe('找到 15 个结果');
 expect(root.querySelector('input')!.value).toBe('Found 3 results');session.stop();expect(label.textContent).toBe('Found 15 results');
});
test('view ownership requires a unique installed plugin object, not matching names or prefixes',()=>{
 const plugin={manifest:{id:'one'}};const plugins={one:plugin,two:{}};const installed=new Set(['one','two']);
 expect(viewOwner({plugin},plugins,installed)).toBe('one');
 expect(viewOwner({plugin:{manifest:{id:'one'}}},plugins,installed)).toBeUndefined();
 expect(viewOwner({getViewType:()=> 'one-panel'},plugins,installed)).toBeUndefined();
 expect(viewOwner({plugin},{one:plugin,two:plugin},installed)).toBeUndefined();
 expect(viewOwner({plugin},plugins,new Set())).toBeUndefined();
});
test('changing a control role re-evaluates its original label rather than translating the previous Chinese',async()=>{
 const root=document.createElement('div');root.innerHTML='<div role="button">Open</div>';
 const label=root.firstElementChild!;
 const session=new LocalUi(root,(text,role)=>text==='Open'?(role==='action'?'打开':role==='heading'?'开放状态':undefined):undefined,{set:()=>()=>{}});
 expect(label.textContent).toBe('打开');label.setAttribute('role','heading');await Promise.resolve();session.scan();
 expect(label.textContent).toBe('开放状态');label.classList.add('markdown-rendered');await Promise.resolve();session.scan();
 expect(label.textContent).toBe('Open');session.stop();
});
test('translated dropdown labels refit without changing the selected value or firing a change event',()=>{
 const mock=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({font:'',measureText:(text:string)=>({width:text.length*20})}as any);
 const root=document.createElement('div');root.innerHTML='<select class="dropdown" style="--dropdown-fitted-width: 50px;padding-left:10px;padding-right:20px"><option value="pdf">PDF</option><option value="raw">RAW</option></select>';
 const select=root.querySelector('select')!,changed=vi.fn();select.addEventListener('change',changed);
 const session=new LocalUi(root,text=>text==='PDF'?'PDF 文档':text==='RAW'?'原始格式':undefined);
 try{expect(Number.parseFloat(select.style.getPropertyValue('--dropdown-fitted-width'))).toBeGreaterThan(100);expect(select.value).toBe('pdf');expect(changed).not.toHaveBeenCalled();
  select.value='raw';select.dispatchEvent(new Event('change',{bubbles:true}));expect(select.value).toBe('raw');expect(changed).toHaveBeenCalledTimes(1);
  session.stop();expect(select.style.getPropertyValue('--dropdown-fitted-width')).toBe('50px');expect(select.selectedOptions[0].textContent).toBe('RAW');
 }finally{session.stop();mock.mockRestore();}
});


test('measurement and focus classes keep translated labels stable while semantic classes still restore them',async()=>{
 const root=document.createElement('div');root.innerHTML='<button>Open</button><select class="dropdown"><option value="x">PDF</option></select>';
 const label=root.querySelector('button')!,select=root.querySelector('select')!;
 const session=new LocalUi(root,text=>text==='Open'?'打开':text==='PDF'?'PDF 文档':undefined,{set:()=>()=>{}});
 try{select.classList.add('is-measuring');label.classList.add('is-focused');await Promise.resolve();
  expect(label.textContent).toBe('打开');expect(select.options[0].textContent).toBe('PDF 文档');
  label.classList.add('markdown-rendered');await Promise.resolve();session.scan();expect(label.textContent).toBe('Open');
 }finally{session.stop();}
});
