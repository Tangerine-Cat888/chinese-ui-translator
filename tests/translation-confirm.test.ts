import {test,expect,vi} from 'vitest';
import type {App} from 'obsidian';
vi.mock('obsidian',()=>({
 Modal:class {
  contentEl=document.createElement('div');
  onOpen(){} onClose(){}
  setTitle(title:string){this.contentEl.setAttribute('aria-label',title);}
  open(){document.body.append(this.contentEl);this.onOpen();}
  close(){this.contentEl.remove();this.onClose();}
 },
 Setting:class {
  constructor(private el:HTMLElement){}
  addButton(callback:(button:any)=>void){const el=document.createElement('button');this.el.append(el);const button={setButtonText(text:string){el.textContent=text;return button;},setCta(){return button;},onClick(fn:()=>void){el.onclick=fn;return button;}};callback(button);return this;}
 }
}));
import {confirmLargeTranslation} from '../src/translation-confirm';
test('only more than 3000 remaining entries require explicit confirmation',async()=>{
 const controller=new AbortController();
 expect(await confirmLargeTranslation({}as App,3000,controller.signal)).toBe(true);expect(document.querySelector('button')).toBeNull();
 const pending=confirmLargeTranslation({}as App,3001,controller.signal);
 expect(document.querySelector('[aria-label="翻译词条较多"]')).not.toBeNull();
 const buttons=document.querySelectorAll('button');expect([...buttons].map(b=>b.textContent)).toEqual(['取消翻译','继续翻译']);
 buttons[0].click();expect(await pending).toBe(false);
 const next=confirmLargeTranslation({}as App,6235,controller.signal);
 document.querySelectorAll('button')[1].click();expect(await next).toBe(true);
 const canceled=confirmLargeTranslation({}as App,6235,controller.signal);controller.abort();expect(await canceled).toBe(false);expect(document.querySelector('button')).toBeNull();
});
