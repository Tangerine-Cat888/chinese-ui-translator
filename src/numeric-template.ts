const token=/⟦BA(\d+)⟧/g;
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/** Patterns are constructed only from escaped literal text and bounded numeric slots. */
export function numericValues(source:string,text:string):string[]|undefined{
 if(source.length>1500||text.length>1500)return;
 const slots=[...source.matchAll(token)];if(!slots.length||slots.length>3)return;
 if(slots.some((slot,i)=>slot[1]!==String(i)))return;
 const parts=source.split(/⟦BA\d+⟧/);
 if(parts.join('').replace(/[^a-z]/gi,'').length<4)return;
 // Adjacent slots and slots embedded in identifiers/versions are deliberately unsupported.
 if(parts.some((part,i)=>i>0&&i<parts.length-1&&!part.trim()))return;
 if(slots.some((_,i)=>/[\w./\\-]$/.test(parts[i])||/^[\w./\\-]/.test(parts[i+1])))return;
 const match=new RegExp('^'+parts.map(escape).join('(\\d{1,12}(?:\\.\\d{1,6})?)')+'$').exec(text);
 return match?.slice(1);
}
export function renderNumeric(source:string,target:string,text:string):string|undefined{
 const values=numericValues(source,text);if(!values)return;
 const sourceTokens=source.match(token)||[],targetTokens=target.match(token)||[];
 if([...sourceTokens].sort().join('|')!==[...targetTokens].sort().join('|'))return;
 return target.replace(token,(_all,index:string)=>values[Number(index)]);
}
export function templateSource(text:string,sources:string[]):string{
 const matches=sources.filter(source=>numericValues(source,text));
 return matches.length===1?matches[0]:text;
}
