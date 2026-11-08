import {parse,tokenizer} from 'acorn';
import {yieldToUi} from './clock';
import {numericValues} from './numeric-template';
export function isLabelText(text:string,names:Set<string>){
 const s=text.trim();
 return s.length>=2&&s.length<=1500&&!names.has(s)&&/[A-Za-z]{2}/.test(s)&&
  !/^(https?:|data:|[./#]|[A-Z]:\\)|[{}<>]|=>|\b(function|const|var)\b/.test(s)&&
  !/^[\w.-]+\.(js|css|json|md|png|svg|ts)$/i.test(s);
}
type Syntax=Record<string,unknown>;
function syntax(value:unknown):Syntax|undefined{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Syntax:undefined;}
function simpleReference(value:unknown,depth=0):boolean{
 const node=syntax(value);if(!node||depth>5)return false;
 return node.type==='Identifier'||node.type==='MemberExpression'&&node.computed===false&&syntax(node.property)?.type==='Identifier'&&simpleReference(node.object,depth+1);
}
/** Only literal arguments in known display positions get the relaxed text filter. */
async function displayPositions(source:string,signal?:AbortSignal){
 const positions=new Set<number>();
 const templates=new Set<string>();
 const addTemplate=(literal:Syntax|undefined)=>{
  if(literal?.type!=='TemplateLiteral'||!Array.isArray(literal.expressions)||!literal.expressions.length||literal.expressions.length>3||!Array.isArray(literal.quasis))return;
  if((literal.expressions as unknown[]).some(value=>!simpleReference(value)))return;
  const parts=(literal.quasis as unknown[]).map(value=>syntax(syntax(value)?.value)?.cooked);
  if(parts.some(value=>typeof value!=='string'||/[{}<>]|⟦|⟧/.test(value)))return;
  const text=parts.map((value,i)=>String(value)+(i<parts.length-1?`⟦BA${i}⟧`:'')).join('').trim();
  if(text.length<=1500&&/[A-Za-z]{4}/.test(text)&&numericValues(text,text.replace(/⟦BA\d+⟧/g,'1')))templates.add(text);
 };
 let root:ReturnType<typeof parse>;
 try{root=parse(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});}catch(error){if(error instanceof SyntaxError)return {positions,templates};throw error;}
 const stack:unknown[]=[root];let count=0;
 const first=new Set(['setName','setDesc','setTitle','setButtonText','setPlaceholder','setTooltip','setText','setLabel','setHeading','setHint','setWarning']);
 while(stack.length){
  if(signal?.aborted)throw new Error('已取消汉化');
  const node=syntax(stack.pop());if(!node)continue;
  if(node.type==='CallExpression'){
   const callee=syntax(node.callee),property=syntax(callee?.property);
   const method=callee?.type==='MemberExpression'&&callee.computed===false?property?.name:undefined;
   const args:unknown[]=Array.isArray(node.arguments)?node.arguments as unknown[]:[];
   const selected=typeof method==='string'&&first.has(method)?args[0]:method==='addOption'?args[1]:undefined;
   const literal=syntax(selected);if(literal?.type==='Literal'&&typeof literal.value==='string'&&typeof literal.start==='number')positions.add(literal.start);
   addTemplate(literal);
   if(literal?.type==='TemplateLiteral'&&Array.isArray(literal.expressions)&&literal.expressions.length===0&&typeof literal.start==='number')positions.add(literal.start+1);
   const options=syntax(method==='createEl'?args[1]:method==='createDiv'||method==='createSpan'||method==='addOptions'?args[0]:undefined);
   if(options?.type==='ObjectExpression'&&Array.isArray(options.properties))for(const entry of options.properties as unknown[]){
    const property=syntax(entry),key=syntax(property?.key),value=syntax(property?.value);
    const name=key?.name??key?.value;
    if(property?.type==='Property'&&property.computed===false&&(method==='addOptions'||typeof name==='string'&&['text','title','placeholder','aria-label'].includes(name)))addTemplate(value);
    if(property?.type==='Property'&&property.computed===false&&(method==='addOptions'||typeof name==='string'&&['text','title','placeholder','aria-label'].includes(name))&&value?.type==='Literal'&&typeof value.value==='string'&&typeof value.start==='number')positions.add(value.start);
   }
  }
  for(const value of Object.values(node)){if(Array.isArray(value)){for(const child of value as unknown[])stack.push(child);}else if(syntax(value))stack.push(value);}
  if(++count%3000===0)await yieldToUi();
 }
 return {positions,templates};
}
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
 const {positions,templates}=await displayPositions(source,signal);
 const tokens=tokenizer(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});
 const strings=new Set<string>();let count=0;
 for(;;){
  if(signal?.aborted)throw new Error('已取消汉化');
  const token=tokens.getToken() as ReturnType<typeof tokens.getToken> & {value?:unknown};if(token.type.label==='eof')break;
  if(token.type.label==='string'&&typeof token.value==='string'&&(positions.has(token.start)?isLabelText(token.value,names):isUiCandidate(token.value,names)))strings.add(token.value.trim());
  if(token.type.label==='template'&&typeof token.value==='string'&&source[token.end]==='`'&&source[token.start-1]==='`'&&(positions.has(token.start)?isLabelText(token.value,names):isUiCandidate(token.value,names)))strings.add(token.value.trim());
  if(strings.size>3000)throw new Error('可识别词条超过 3000 条，暂不自动处理此大型插件');
  if(++count%3000===0)await yieldToUi();
 }
 const result=[...new Set([...strings,...templates])];if(result.length>3000)throw new Error('可识别词条超过 3000 条，暂不自动处理此大型插件');return result;
}
