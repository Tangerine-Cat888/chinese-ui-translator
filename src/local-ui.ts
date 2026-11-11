import type {Clock} from './clock';
import {defaultClock} from './clock';
import {isLabelText} from './scanner';
import {uiRole,type UiEntry} from './ui-context';
import {referencedLabels} from './semantic-labels';
const excluded='script,style,pre,code,textarea,input,[contenteditable]:not([contenteditable="false"]),.cm-editor,.markdown-source-view,.markdown-preview-view,.markdown-rendered,.suggestion-content,.tree-item-inner,.view-header-title,.vertical-tab-nav-item,[data-ba-ignore],svg,iframe';
const labels='.setting-item-name,.setting-item-description,.setting-item-info,.menu-item-title,.modal-title,.modal-description,button,label,option,legend,h1,h2,h3,h4,h5,h6,summary,[role="heading"],[role="button"],[role="tab"],[role="checkbox"],[role="switch"],[role="radio"],.ba-plugin-view';
const inline='span,strong,em,b,i,small';
const semanticClasses=new Set([...(`${excluded},${labels}`).matchAll(/\.([\w-]+)/g)].map(match=>match[1]));
function contextChanged(record:MutationRecord,classes=semanticClasses){
 if(record.type!=='attributes')return false;
 if(['role','id','aria-labelledby','aria-describedby','contenteditable'].includes(record.attributeName||''))return true;
 if(record.attributeName!=='class')return false;
 const previous=new Set((record.oldValue||'').split(/\s+/)),current=(record.target as Element).classList;
 return [...classes].some(name=>previous.has(name)!==current.contains(name));
}
function textNodes(root:HTMLElement){const result:Text[]=[];const walker=root.ownerDocument.createTreeWalker(root,4);let node:Node|null;while((node=walker.nextNode()))result.push(node as Text);return result;}
function permitted(el:Element,selectors=labels){return !el.closest(excluded)&&!el.closest('option:not([value])')&&!!el.closest(selectors);}
/** Collect only recognizable UI labels, never input values or arbitrary settings content. */
export function collectUiLabels(root:HTMLElement,names:Set<string>,readText:(node:Text)=>string=node=>node.nodeValue||'',readAttribute:(el:Element,key:string)=>string|null=(el,key)=>el.getAttribute(key),onEntry?:(entry:UiEntry)=>void,extraLabels=''){
 const references=referencedLabels(root,excluded);
 const selectors=[labels,extraLabels,references.selectors].filter(Boolean).join(',');
 const role=(el:Element)=>references.role(el)??uiRole(el);
 const result=new Set<string>();const add=(s:string|null,role:string)=>{if(s&&isLabelText(s,names)){result.add(s.trim());onEntry?.({text:s.trim(),role});}};
 for(const node of textNodes(root))if(node.parentElement&&permitted(node.parentElement,selectors))add(readText(node),role(node.parentElement));
 root.querySelectorAll<HTMLElement>(selectors).forEach(el=>{if(permitted(el,selectors)&&[...el.querySelectorAll('*')].every(child=>child.matches(inline)&&!child.closest(excluded)))add(textNodes(el).map(readText).join(''),role(el));});
 root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el=>{if(!el.closest(excluded.replace('textarea,input,','')))for(const key of ['title','aria-label','placeholder'])add(readAttribute(el,key),uiRole(el,key));});
 return [...result];
}
type Patch={source:string;applied:string};
/** Applies only saved labels and bounded numeric templates. No model, API or asynchronous translation here. */
export class LocalUi {
 private text=new Map<Text,Patch>();private attributes=new Map<Element,Map<string,Patch>>();private observer:MutationObserver;private timer?:()=>void;
 private groups=new Map<HTMLElement,Text[]>();
 private widths=new Map<HTMLSelectElement,{source:string;applied:string;priority:string}>();
 private selectors:string;
 private referenceRole:(el:Element)=>string|undefined=()=>undefined;
 private changed=()=>this.scan();
 collect(names:Set<string>,onEntry?:(entry:UiEntry)=>void){return collectUiLabels(this.root,names,node=>{const p=this.text.get(node);return p&&node.nodeValue===p.applied?p.source:node.nodeValue||'';},(el,key)=>{const p=this.attributes.get(el)?.get(key);return p&&el.getAttribute(key)===p.applied?p.source:el.getAttribute(key);},onEntry,this.extraLabels);}
 constructor(readonly root:HTMLElement,private lookup:(text:string,role:string)=>string|undefined,private clock:Clock=defaultClock,private extraLabels='',private fallback?:(text:string,el:Element)=>string|undefined){
  this.selectors=extraLabels?labels+','+extraLabels:labels;
  const classes=new Set([...semanticClasses,...[...extraLabels.matchAll(/\.([\w-]+)/g)].map(match=>match[1])]);
  const win=root.ownerDocument.defaultView!;
  this.observer=new win.MutationObserver(records=>{if(records.some(record=>contextChanged(record,classes)))this.restore();if(!this.timer)this.timer=this.clock.set(()=>{this.timer=undefined;this.scan();},80);});
  this.observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['title','aria-label','placeholder','role','class','id','aria-labelledby','aria-describedby','contenteditable']});root.addEventListener('change',this.changed);this.scan();
 }
 scan(){
  const references=referencedLabels(this.root,excluded);
  const selectors=[labels,this.extraLabels,references.selectors].filter(Boolean).join(',');
  if(selectors!==this.selectors){this.restore();this.selectors=selectors;}
  this.referenceRole=references.role;
  for(const [el,nodes] of this.groups){
   const current=textNodes(el);
   if(!this.root.contains(el)||current.length!==nodes.length||nodes.some((node,index)=>current[index]!==node||node.nodeValue!==this.text.get(node)?.applied)){
    for(const node of nodes){const p=this.text.get(node);if(p&&node.nodeValue===p.applied)node.nodeValue=p.source;this.text.delete(node);}
    this.groups.delete(el);
   }
  }
  for(const [node,p] of this.text)if(!this.root.contains(node)){if(node.nodeValue===p.applied)node.nodeValue=p.source;this.text.delete(node);}
  // Keep inline elements and listeners intact: distribute a full-label translation over existing text nodes.
  this.root.querySelectorAll<HTMLElement>(this.selectors).forEach(el=>{
   if(!permitted(el,this.selectors)||![...el.querySelectorAll('*')].every(child=>child.matches(inline)&&!child.closest(excluded)))return;
   const nodes=textNodes(el);if(nodes.length<2)return;
   const source=nodes.map(node=>{const patch=this.text.get(node);return patch&&node.nodeValue===patch.applied?patch.source:node.nodeValue||'';}).join('');
   const value=this.lookup(source.trim(),this.referenceRole(el)??uiRole(el));if(!value)return;
   nodes.forEach((node,index)=>{const old=this.text.get(node);const original=old&&node.nodeValue===old.applied?old.source:node.nodeValue||'';const applied=index===0?source.replace(source.trim(),()=>value):'';this.text.set(node,{source:original,applied});if(node.nodeValue!==applied)node.nodeValue=applied;});
   this.groups.set(el,nodes);
  });
  const walker=this.root.ownerDocument.createTreeWalker(this.root,4);let node:Node|null;
  while((node=walker.nextNode())){
   const el=node.parentElement;if(!el||el.closest(excluded)||!el.closest(this.selectors))continue;
   // Without an explicit value, HTML uses the label itself as the submitted value.
   if(el.closest('option:not([value])'))continue;
   const text=node as Text,old=this.text.get(text);if(old&&text.nodeValue===old.applied)continue;
   this.text.delete(text);const source=text.nodeValue||'',value=this.lookup(source.trim(),this.referenceRole(el)??uiRole(el))??this.fallback?.(source.trim(),el);
   if(value&&value!==source.trim()){const applied=source.replace(source.trim(),()=>value);this.text.set(text,{source,applied});text.nodeValue=applied;}
  }
  for(const [el,attrs] of this.attributes)if(!this.root.contains(el)){for(const [key,p] of attrs)if(el.getAttribute(key)===p.applied)el.setAttribute(key,p.source);this.attributes.delete(el);}
  this.root.querySelectorAll<HTMLElement>('[title],[aria-label],[placeholder]').forEach(el=>{
   if(el.closest(excluded.replace('textarea,input,','')))return;
   for(const key of ['title','aria-label','placeholder']){
    const source=el.getAttribute(key);if(!source)continue;const attrs=this.attributes.get(el)||new Map<string,Patch>(),old=attrs.get(key);if(old&&source===old.applied)continue;
    attrs.delete(key);const value=this.lookup(source.trim(),uiRole(el,key));if(value&&value!==source.trim()){attrs.set(key,{source,applied:value});this.attributes.set(el,attrs);el.setAttribute(key,value);}
   }
  });
  // Obsidian fits native dropdowns to their original selected label. Refit the translated label without firing change.
  for(const [select,p] of this.widths)if(!this.root.contains(select)){if(select.style.getPropertyValue('--dropdown-fitted-width')===p.applied)select.style.setProperty('--dropdown-fitted-width',p.source,p.priority);this.widths.delete(select);}
  this.root.querySelectorAll<HTMLSelectElement>('select.dropdown:not(.is-measuring)').forEach(select=>{
   const option=select.selectedOptions[0];if(!option||!textNodes(option).some(node=>this.text.has(node)))return;
   const property='--dropdown-fitted-width',current=select.style.getPropertyValue(property);if(!current)return;
   const old=this.widths.get(select),source=old&&current===old.applied?old.source:current;
   const style=select.ownerDocument.defaultView!.getComputedStyle(select),context=createEl('canvas').getContext('2d');if(!context)return;
   context.font=style.font||`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
   const padding=[style.paddingLeft,style.paddingRight,style.borderLeftWidth,style.borderRightWidth].reduce((sum,value)=>sum+(Number.parseFloat(value)||0),0);
   const width=Math.ceil(context.measureText(option.textContent||'').width+padding+2),applied=`${Math.max(Number.parseFloat(source)||0,width)}px`;
   this.widths.set(select,{source,applied,priority:old?.priority||select.style.getPropertyPriority(property)});
   if(current!==applied)select.style.setProperty(property,applied);
  });
 }
 private restore(){for(const [node,p] of this.text)if(node.nodeValue===p.applied)node.nodeValue=p.source;for(const [el,attrs] of this.attributes)for(const [key,p] of attrs)if(el.getAttribute(key)===p.applied)el.setAttribute(key,p.source);for(const [select,p] of this.widths)if(select.style.getPropertyValue('--dropdown-fitted-width')===p.applied)select.style.setProperty('--dropdown-fitted-width',p.source,p.priority);this.text.clear();this.attributes.clear();this.groups.clear();this.widths.clear();}
 stop(){this.timer?.();this.observer.disconnect();this.root.removeEventListener('change',this.changed);this.restore();}
}
