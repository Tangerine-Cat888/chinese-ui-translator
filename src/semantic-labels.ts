/** Resolve explicit accessible names/descriptions inside the same UI root. */
export function referencedLabels(root:HTMLElement,excluded:string){
 const targets=new Map<string,Element[]>();
 for(const el of root.querySelectorAll('[id]')){const list=targets.get(el.id)||[];list.push(el);targets.set(el.id,list);}
 const roles=new Map<Element,Set<string>>();
 const controls='button,input,select,textarea,[role="button"],[role="checkbox"],[role="switch"],[role="radio"],[role="combobox"],[role="slider"],[role="spinbutton"],[role="textbox"],[role="tab"],[role="group"],[role="dialog"]';
 for(const control of root.querySelectorAll(controls)){
  if(control.closest(excluded.replace('textarea,input,','')))continue;
  for(const [attribute,role] of [['aria-labelledby','label'],['aria-describedby','description']]){
   for(const id of (control.getAttribute(attribute)||'').trim().split(/\s+/)){
    const matches=targets.get(id);if(!id||id.length>256||[...id].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)||matches?.length!==1)continue;
    const target=matches[0];
    if(target.contains(control)||target.closest(excluded)||target.querySelector(excluded)||target.querySelector(controls))continue;
    if((target.textContent?.length||0)>1500||[...target.querySelectorAll('*')].some(child=>!child.matches('span,strong,em,b,i,small,br')))continue;
    const set=roles.get(target)||new Set<string>();set.add(role);roles.set(target,set);
   }
  }
 }
 const selectors=[...roles.keys()].map(el=>'[id="'+el.id.replace(/["\\]/g,c=>'\\'+c)+'"]').join(',');
 return {selectors,role:(el:Element)=>{
  for(let current:Element|null=el;current&&root.contains(current);current=current.parentElement){const set=roles.get(current);if(set)return set.size===1?[...set][0]:'label';}
  return undefined;
 }};
}
