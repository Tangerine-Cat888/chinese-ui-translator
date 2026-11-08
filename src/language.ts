import {tokenizer} from 'acorn';
import {yieldToUi} from './clock';
import {isUiCandidate} from './scanner';
export interface LanguageResult {kind:'english'|'chinese'|'unknown';english:number;chinese:number}
/** Inspect UI literals and bundled Chinese localization; ignore identifiers and log noise. */
export async function detectInterfaceLanguage(source:string,names:Set<string>):Promise<LanguageResult>{
 if(source.length>20_000_000)return {kind:'unknown',english:0,chinese:0};
 const tokens=tokenizer(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});
 const en=new Set<string>(),zh=new Set<string>(),uiEn=new Set<string>(),uiZh=new Set<string>();
 const recent:{label:string;value?:unknown}[]=[];let count=0;
 for(;;){
  const token=tokens.getToken() as ReturnType<typeof tokens.getToken>&{value?:unknown};if(token.type.label==='eof')break;
  if(token.type.label==='string'&&typeof token.value==='string'){
   const s=token.value.trim();const a=recent.at(-2),b=recent.at(-1);
   const ui=(b?.label==='('&&typeof a?.value==='string'&&/^(setName|setDesc|setTitle|setButtonText|setTooltip|setPlaceholder|setText)$/.test(a.value))||(b?.label===':'&&typeof a?.value==='string'&&/^(text|title|label|placeholder|description)$/.test(a.value));
   if(!names.has(s)&&s.length>=2&&s.length<=1500){
    if((s.match(/[\u3400-\u9fff]/g)||[]).length>=2){zh.add(s);if(ui)uiZh.add(s);}
    else if(s!=='use strict'&&isUiCandidate(s,names)){en.add(s);if(ui)uiEn.add(s);}
   }
  }
  recent.push({label:token.type.label,value:token.value});if(recent.length>3)recent.shift();
  if(++count%3000===0)await yieldToUi();
 }
 // Many Chinese literals indicate a built-in Chinese language pack even when the
 // bundle also contains English dependencies or fallback translations.
 const chinese=zh.size>=10||(uiZh.size>=2&&uiZh.size>=uiEn.size);
 const english=!chinese&&(uiEn.size>=2||(zh.size===0&&en.size>=3));
 return {kind:chinese?'chinese':english?'english':'unknown',english:uiEn.size,chinese:uiZh.size};
}
