import {test,expect,vi} from 'vitest';
import {LocalUi,collectUiLabels} from '../src/local-ui';

test('empty and plaintext-only editors remain untouched and editable transitions restore text',async()=>{
 const root=document.createElement('div');root.innerHTML='<label contenteditable>Private editor</label><label contenteditable="plaintext-only">Private editor</label><label>Editable later</label>';
 const session=new LocalUi(root,t=>t==='Editable later'?'稍后编辑':'不应翻译');
 expect(root.children[0].textContent).toBe('Private editor');expect(root.children[1].textContent).toBe('Private editor');
 expect(collectUiLabels(root,new Set())).not.toContain('Private editor');
 root.children[2].setAttribute('contenteditable','');await Promise.resolve();
 expect(root.children[2].textContent).toBe('Editable later');session.stop();
});

test('ARIA descriptions containing nested interactive roles are not collected as plain descriptions',()=>{
 const root=document.createElement('div');root.innerHTML='<input aria-describedby="complex"><div id="complex">Private wrapper <span role="slider">Value</span></div>';
 expect(collectUiLabels(root,new Set())).not.toContain('Private wrapper');
 const session=new LocalUi(root,()=> '不应翻译');expect(root.children[1].firstChild!.textContent).toBe('Private wrapper ');session.stop();
});

test('generic ARIA names and descriptions translate without plugin-specific classes and retain their roles',()=>{
 const root=document.createElement('div');root.innerHTML='<div id=":r1:">Enable <strong>sync</strong></div><span id="help">Sync automatically</span><input aria-labelledby=":r1:" aria-describedby="help" value="Private value"><h5>Advanced settings</h5><fieldset><legend>Connection settings</legend></fieldset>';
 const original=root.innerHTML,control=root.querySelector('input'),strong=root.querySelector('strong');
 const roles:{text:string;role:string}[]=[];
 expect(collectUiLabels(root,new Set(),undefined,undefined,e=>roles.push(e))).toContain('Enable sync');
 expect(roles).toContainEqual({text:'Sync automatically',role:'description'});
 const lookup=vi.fn((text:string)=>({'Enable sync':'启用同步','Sync automatically':'自动同步','Advanced settings':'高级设置','Connection settings':'连接设置'}[text]));
 const session=new LocalUi(root,lookup);
 expect(root.children[0].textContent).toBe('启用同步');expect(root.children[1].textContent).toBe('自动同步');expect(root.querySelector('h5')!.textContent).toBe('高级设置');expect(root.querySelector('legend')!.textContent).toBe('连接设置');
 expect(lookup).toHaveBeenCalledWith('Sync automatically','description');expect(root.querySelector('input')).toBe(control);expect(control!.value).toBe('Private value');expect(root.querySelector('strong')).toBe(strong);
 session.stop();expect(root.innerHTML).toBe(original);
});
test('ARIA references cannot widen translation into editor, notes, another root or duplicate IDs',()=>{
 const root=document.createElement('div');root.innerHTML='<input aria-describedby="note edit duplicate outside complex"><div class="markdown-rendered"><span id="note">Private content</span></div><div contenteditable="true" id="edit">Private content</div><span id="duplicate">Private content</span><span id="duplicate">Private content</span><div id="complex"><div>Private content</div></div><div>Private content</div>';
 const outside=document.createElement('span');outside.id='outside';outside.textContent='Private content';document.body.append(root,outside);const original=root.innerHTML;
 const session=new LocalUi(root,()=> '不应翻译');expect(root.innerHTML).toBe(original);expect(outside.textContent).toBe('Private content');expect(collectUiLabels(root,new Set())).not.toContain('Private content');session.stop();root.remove();outside.remove();
});
test('changing reference targets restores old labels and translates newly linked labels',()=>{
 const root=document.createElement('div');root.innerHTML='<input aria-describedby="first"><div id="first">First help</div><span id="second">Second help</span>';
 const session=new LocalUi(root,t=>({'First help':'第一条说明','Second help':'第二条说明'}[t]));expect(root.children[1].textContent).toBe('第一条说明');
 root.querySelector('input')!.setAttribute('aria-describedby','second');session.scan();expect(root.children[1].textContent).toBe('First help');expect(root.children[2].textContent).toBe('第二条说明');
 root.querySelector('input')!.removeAttribute('aria-describedby');session.scan();expect(root.children[2].textContent).toBe('Second help');session.stop();
});
