export interface UiEntry {text:string;role:string}
export function uiRole(el:Element,attribute?:string):string{
 if(attribute)return attribute==='placeholder'?'placeholder':'tooltip';
 const control=el.closest('button,[role="button"],option,[role="tab"],.setting-item-description,.setting-item-name,.menu-item-title,label,h1,h2,h3,h4,summary,[role="heading"]');
 if(!control)return 'label';
 if(control.matches('button,[role="button"],.menu-item-title'))return 'action';
 if(control.matches('option'))return 'option';
 if(control.matches('.setting-item-description'))return 'description';
 if(control.matches('h1,h2,h3,h4,summary,[role="heading"]'))return 'heading';
 if(control.matches('[role="tab"]'))return 'tab';
 return 'label';
}
/** Only an actual plugin instance reference proves ownership; names/type prefixes do not. */
export function viewOwner(view:unknown,plugins:Record<string,unknown>,installed:Set<string>):string|undefined{
 if(!view||typeof view!=='object')return;
 const plugin=(view as {plugin?:unknown}).plugin;if(!plugin||typeof plugin!=='object')return;
 const owners=Object.keys(plugins).filter(id=>installed.has(id)&&plugins[id]===plugin);
 return owners.length===1?owners[0]:undefined;
}
