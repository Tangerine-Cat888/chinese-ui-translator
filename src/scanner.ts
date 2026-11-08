import {tokenizer} from 'acorn';
import {yieldToUi} from './clock';
export function isUiCandidate(text:string,names:Set<string>){
 const s=text.trim();
 if(s.length<2||s.length>1500||names.has(s)||!/[A-Za-z]{2}/.test(s)||/[\u3400-\u9fff]/.test(s))return false;
 if(/^(https?:|data:|[./#]|[A-Z]:\\)|[{}<>]|=>|\b(function|const|var)\b/.test(s))return false;
 if(/^[\w.-]+\.(js|css|json|md|png|svg|ts)$/i.test(s)||/^[a-z\d]+(?:[-_.:/][a-z\d]+)+$/.test(s))return false;
 return /\s/.test(s)||/^[A-Z][a-z]{2,}[!?…:]?$/.test(s);
}
/** Tokenize code as data; never execute third-party plugin source. Yield between chunks. */
export async function extractLabels(source:string,names:Set<string>,signal?:AbortSignal){
 if(source.length>20_000_000)throw new Error('插件代码超过 20 MB，暂不自动扫描');
 const tokens=tokenizer(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});
 const strings=new Set<string>();let count=0;
 for(;;){
  if(signal?.aborted)throw new Error('已取消汉化');
  const token=tokens.getToken() as ReturnType<typeof tokens.getToken> & {value?:unknown};if(token.type.label==='eof')break;
  if(token.type.label==='string'&&typeof token.value==='string'&&isUiCandidate(token.value,names))strings.add(token.value.trim());
  if(token.type.label==='template'&&typeof token.value==='string'&&source[token.end]==='`'&&source[token.start-1]==='`'&&isUiCandidate(token.value,names))strings.add(token.value.trim());
  if(strings.size>3000)throw new Error('可识别词条超过 3000 条，暂不自动处理此大型插件');
  if(++count%3000===0)await yieldToUi();
 }
 return [...strings];
}
