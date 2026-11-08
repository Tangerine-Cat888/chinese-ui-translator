import type {Clock} from './clock';
import {defaultClock} from './clock';
const excluded='script,style,pre,code,textarea,input,[contenteditable="true"],.cm-editor,.markdown-source-view,.markdown-preview-view,.markdown-rendered,.suggestion-content,.tree-item-inner,.view-header-title,.vertical-tab-nav-item,[data-ba-ignore],svg,iframe';
const labels='.setting-item-name,.setting-item-description,.menu-item-title,button,label,option,h1,h2,h3,[role="button"],[role="tab"],.ba-plugin-view';
type Patch={source:string;applied:string};
/** Applies only saved exact matches. No model, API or asynchronous translation here. */
export class LocalUi {
 private text=new Map<Text,Patch>();private attributes=new Map<Element,Map<string,Patch>>();private observer:MutationObserver;private timer?:()=>void;
 constructor(readonly root:HTMLElement,private lookup:(text:string)=>string|undefined,private clock:Clock=defaultClock){
  const win=root.ownerDocument.defaultView!;
  this.observer=new win.MutationObserver(()=>{if(!this.timer)this.timer=this.clock.set(()=>{this.timer=undefined;this.scan();},80);});
  this.observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});this.scan();
 }
 scan(){
  for(const [node,p] of this.text)if(!this.root.contains(node)){if(node.nodeValue===p.applied)node.nodeValue=p.source;this.text.delete(node);}
  const walker=this.root.ownerDocument.createTreeWalker(this.root,4);let node:Node|null;
  while((node=walker.nextNode())){
   const el=node.parentElement;if(!el||el.closest(excluded)||!el.closest(labels))continue;
   // Without an explicit value, HTML uses the label itself as the submitted value.
   if(el.closest('option:not([value])'))continue;
   const text=node as Text,old=this.text.get(text);if(old&&text.nodeValue===old.applied)continue;
   this.text.delete(text);const source=text.nodeValue||'',value=this.lookup(source.trim());
   if(value&&value!==source.trim()){const applied=source.replace(source.trim(),value);this.text.set(text,{source,applied});text.nodeValue=applied;}
  }
  for(const [el,attrs] of this.attributes)if(!this.root.contains(el)){for(const [key,p] of attrs)if(el.getAttribute(key)===p.applied)el.setAttribute(key,p.source);this.attributes.delete(el);}
  this.root.querySelectorAll<HTMLElement>('[title],[aria-label],[placeholder]').forEach(el=>{
   if(el.closest(excluded.replace('textarea,input,','')))return;
   for(const key of ['title','aria-label','placeholder']){
    const source=el.getAttribute(key);if(!source)continue;const attrs=this.attributes.get(el)||new Map<string,Patch>(),old=attrs.get(key);if(old&&source===old.applied)continue;
    attrs.delete(key);const value=this.lookup(source.trim());if(value&&value!==source.trim()){attrs.set(key,{source,applied:value});this.attributes.set(el,attrs);el.setAttribute(key,value);}
   }
  });
 }
 stop(){this.timer?.();this.observer.disconnect();for(const [node,p] of this.text)if(node.nodeValue===p.applied)node.nodeValue=p.source;for(const [el,attrs] of this.attributes)for(const [key,p] of attrs)if(el.getAttribute(key)===p.applied)el.setAttribute(key,p.source);this.text.clear();this.attributes.clear();}
}
