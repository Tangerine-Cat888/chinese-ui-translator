import {requestUrl} from 'obsidian';
import {defaultClock} from './clock';
import {abortError,type Config,type Transport} from './core';
import {isRecord} from './validation';
export type ServiceId='deepseek'|'openai'|'openrouter'|'custom'|'deepl'|'deeplx';
export interface ServiceProfile {secretName?:string;apiKey:string;baseUrl:string;model:string;plan:'free'|'pro'}
export const services:Record<ServiceId,{name:string;kind:'ai'|'machine';baseUrl:string;model:string}>={
 deepseek:{name:'DeepSeek',kind:'ai',baseUrl:'https://api.deepseek.com',model:'deepseek-flash'},
 openai:{name:'OpenAI',kind:'ai',baseUrl:'https://api.openai.com/v1',model:''},
 openrouter:{name:'OpenRouter',kind:'ai',baseUrl:'https://openrouter.ai/api/v1',model:''},
 custom:{name:'自定义兼容服务',kind:'ai',baseUrl:'',model:''},
 deepl:{name:'DeepL',kind:'machine',baseUrl:'https://api-free.deepl.com',model:''},
 deeplx:{name:'DeepLX',kind:'machine',baseUrl:'http://localhost:1188',model:''}
};
export function defaultProfile(id:ServiceId):ServiceProfile{return {apiKey:'',baseUrl:services[id].baseUrl,model:services[id].model,plan:'free'};}
export function serviceUrl(id:ServiceId,p:ServiceProfile,models=false){
 const base=id==='deepl'?(p.plan==='pro'?'https://api.deepl.com':'https://api-free.deepl.com'):p.baseUrl.trim();
 let url:URL;try{url=new URL(base);}catch{throw new Error('请填写有效的服务地址');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('请填写有效的 HTTP(S) 服务地址');
 if(id==='deepl')url.pathname='/v2/translate';
 else if(id==='deeplx'){if(!url.pathname.replace(/\/$/,'').endsWith('/translate'))url.pathname=url.pathname.replace(/\/$/,'')+'/translate';}
 else url.pathname=url.pathname.replace(/\/(chat\/completions|models)\/?$/,'').replace(/\/$/,'')+(models?'/models':'/chat/completions');
 return url.href;
}
export function validateProfile(id:ServiceId,p:ServiceProfile,models=false){serviceUrl(id,p,models);if(id!=='custom'&&id!=='deeplx'&&!p.apiKey.trim())throw new Error('请填写 API Key');if(services[id].kind==='ai'&&!models&&!p.model.trim())throw new Error('请选择或填写模型');}
async function jsonRequest(url:string,headers:Record<string,string>,body:object|undefined,signal:AbortSignal):Promise<unknown>{
 if(signal.aborted)throw abortError();
 return await new Promise((resolve,reject)=>{
  let done=false;const finish=(error?:Error,value?:unknown)=>{if(done)return;done=true;cancelTimer();signal.removeEventListener('abort',cancel);if(error)reject(error);else resolve(value);};
  const cancel=()=>finish(abortError());const cancelTimer=defaultClock.set(()=>finish(new Error('请求超时，请稍后重试')),30000);signal.addEventListener('abort',cancel,{once:true});
  try{Promise.resolve(requestUrl({url,method:body?'POST':'GET',headers,contentType:'application/json',...(body?{body:JSON.stringify(body)}:{}),throw:false})).then(result=>{
   if(result.status>=400){const text=result.status===401||result.status===403?'密钥无效或无访问权限':result.status===429?'请求过于频繁，请稍后重试':result.status===456?'翻译服务额度已用完':`服务返回 HTTP ${result.status}`;finish(Object.assign(new Error(text),{status:result.status}));}
   else{try{finish(undefined,result.json);}catch{finish(new Error('服务返回的内容不是 JSON'));}}
  },()=>finish(new Error('无法连接服务，请检查地址和网络')));}catch{finish(new Error('无法发起服务请求'));}
 });
}
const bearer=(p:ServiceProfile):Record<string,string>=>p.apiKey?{Authorization:`Bearer ${p.apiKey}`}:{ };
export function serviceTransport(id:ServiceId,profile:ServiceProfile):Transport{
 const p={...profile};
 return async(body,signal)=>{
  validateProfile(id,p);const url=serviceUrl(id,p);
  if(services[id].kind==='ai')return jsonRequest(url,bearer(p),body,signal);
  const request=body as {messages:{role:string;content:string}[]};const items=JSON.parse(request.messages.find(m=>m.role==='user')!.content) as {id:string;text:string}[];
  const result:Record<string,string>={};
  if(id==='deepl'){
   const response=await jsonRequest(url,{Authorization:`DeepL-Auth-Key ${p.apiKey}`},{text:items.map(i=>i.text),source_lang:'EN',target_lang:'ZH-HANS'},signal);
   if(!isRecord(response)||!Array.isArray(response.translations)||response.translations.length!==items.length)throw new Error('翻译服务返回的词条数量不匹配');
   const translations:unknown[]=response.translations;
   items.forEach((item,i)=>{const translation=translations[i];if(!isRecord(translation)||typeof translation.text!=='string')throw new Error('翻译服务返回的译文格式无效');result[item.id]=translation.text;});
  }else{
   for(const item of items){const response=await jsonRequest(url,bearer(p),{text:item.text,source_lang:'EN',target_lang:'ZH'},signal);if(!isRecord(response)||response.code!==200||typeof response.data!=='string')throw new Error('DeepLX 未返回有效译文');result[item.id]=response.data;}
  }
  return {choices:[{message:{content:JSON.stringify(result)}}]};
 };
}
export async function listServiceModels(id:ServiceId,p:ServiceProfile,signal:AbortSignal){
 if(services[id].kind!=='ai')return [];validateProfile(id,p,true);
 const response=await jsonRequest(serviceUrl(id,p,true),bearer(p),undefined,signal);
 if(!isRecord(response)||!Array.isArray(response.data))throw new Error('服务未返回模型列表，可手动填写模型名称');
 const models:unknown[]=response.data;
 return [...new Set(models.flatMap(m=>isRecord(m)&&typeof m.id==='string'&&m.id.trim()?[m.id]:[]))].sort();
}
export function engineConfig(id:ServiceId,p:ServiceProfile):Config{return {endpoint:serviceUrl(id,p),apiKey:p.apiKey,model:services[id].kind==='ai'?p.model:id,language:'简体中文',online:true,glossary:{}};}
