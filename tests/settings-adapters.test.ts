import {test,expect} from 'vitest';
import {LocalUi} from '../src/local-ui';
import {settingsLabels,settingsText,chatLabels,chatText} from '../src/settings-adapters';

const log=(path:string)=>`Records the behind-the-scenes messages between Copilot and the agent so a report always has recent activity to attach. Stored on this device only, outside your vault (${path}), and can include your prompts and note contents in plain text.`;
const fallback=(text:string,el:Element)=>settingsText('copilot',text,el);
test('remaining settings labels share dictionary lookup without translating identifiers or code',()=>{
 const root=document.createElement('div');root.innerHTML='<div class="tw-text-xl tw-font-bold">Skills</div><span class="tw-text-xs tw-text-muted">0 loaded</span><div class="tw-text-ui-smaller tw-text-muted">Pages and databases</div><span class="tw-text-ui-small tw-font-semibold">copilot-web-search</span><table><thead><tr><th class="tw-text-muted"><div>Right-click</div></th></tr></thead></table><div class="tw-text-xs tw-text-muted">Fill in variables like {activenote}, {foldername}, or {#tag} in commands. Turn off to send commands exactly as written.</div>';
 const original=root.innerHTML;
 const session=new LocalUi(root,t=>({'Skills':'技能','Pages and databases':'页面和数据库','copilot-web-search':'不应修改'}[t]),undefined,settingsLabels('copilot'),fallback);
 expect(root.textContent).toContain('技能0 项已加载页面和数据库copilot-web-search右键菜单');expect(root.lastElementChild!.textContent).toContain('{activenote}、{foldername} 或 {#tag}');session.stop();expect(root.innerHTML).toBe(original);
 const section=document.createElement('section');section.className='tw-border-interactive-accent tw-text-sm';section.innerHTML='<p>Pages and databases</p><ul><li>Skills</li></ul>';root.append(section);
 const connector=new LocalUi(root,t=>({'Skills':'技能','Pages and databases':'页面和数据库'}[t]),undefined,settingsLabels('copilot'));expect(section.textContent).toBe('页面和数据库技能');connector.stop();
});
test('chat adapters translate empty-input chrome but protect editor and message contents',()=>{
 const root=document.createElement('div');root.innerHTML='<div class="tw-relative"><div class="tw-sr-only">Chat input</div><div class="tw-absolute tw-pointer-events-none tw-select-none">Empty hint</div><div contenteditable="true">Empty hint</div></div><div class="markdown-rendered"><div class="tw-relative"><div class="tw-absolute tw-pointer-events-none tw-select-none">Empty hint</div></div></div><div>Empty hint</div>';
 const original=root.innerHTML;
 const session=new LocalUi(root,t=>t==='Empty hint'?'输入提示':t==='Chat input'?'聊天输入':undefined,undefined,chatLabels('copilot','copilot-chat-view'));
 expect(root.firstElementChild!.textContent).toBe('聊天输入输入提示Empty hint');expect(root.querySelector('[contenteditable]')!.textContent).toBe('Empty hint');expect(root.querySelector('.markdown-rendered')!.textContent).toBe('Empty hint');expect(root.lastElementChild!.textContent).toBe('Empty hint');session.stop();expect(root.innerHTML).toBe(original);
 expect(chatLabels('other','copilot-chat-view')).toBe('');expect(chatLabels('copilot','unknown')).toBe('');expect(chatText('copilot','copilot-agent-chat-view',"OpenCode isn't set up on this machine yet.")).toBe('此电脑尚未配置 OpenCode。');expect(chatText('other','copilot-agent-chat-view',"OpenCode isn't set up on this machine yet.")).toBeUndefined();
});
test('Copilot split fallbacks retain links, code, exact whitespace and restore original DOM',()=>{
 const root=document.createElement('div');
 root.innerHTML='<div class="tw-text-sm tw-text-muted"><div><a href="https://www.obsidiancopilot.com/pricing">Copilot paid plans</a> add <strong>premium chat models</strong></div></div><div class="tw-text-xs tw-text-muted">Set values for <span>OpenCode</span>, like <code>XDG_CONFIG_HOME</code> or <code>HTTPS_PROXY</code>.</div><div class="tw-text-xs tw-text-muted"><span class="tw-text-warning">No API keys found in this device\'s <strong>Obsidian Keychain</strong>. Re-enter your API keys in the relevant settings sections — each device has a separate Keychain.</span></div><div class="tw-text-xs tw-text-muted">or</div>';
 const original=root.innerHTML,anchor=root.querySelector('a'),code=root.querySelector('code');
 const translations:Record<string,string>={'Copilot paid plans':'Copilot 付费计划','premium chat models':'高级聊天模型','Set values for':'设置值：','No API keys found in this device\'s':'此设备未找到 API 密钥：'};
 const session=new LocalUi(root,text=>translations[text],undefined,settingsLabels('copilot'),fallback);
 expect(root.children[0].textContent).toBe('Copilot 付费计划 提供 高级聊天模型');
 expect(root.children[1].textContent).toContain('XDG_CONFIG_HOME 或 HTTPS_PROXY');
 expect(root.children[2].textContent).toContain('。请在相应设置中重新输入 API 密钥');
 expect(root.lastElementChild!.textContent).toBe('or');expect(root.querySelector('a')).toBe(anchor);expect(anchor!.getAttribute('href')).toBe('https://www.obsidiancopilot.com/pricing');expect(root.querySelector('code')).toBe(code);expect(code!.textContent).toBe('XDG_CONFIG_HOME');
 session.stop();expect(root.innerHTML).toBe(original);
});
test('dynamic log descriptions copy paths literally, update locally and stay scoped',()=>{
 const root=document.createElement('div'),el=document.createElement('div');el.className='tw-text-xs tw-text-muted';root.append(el);
 const path='C:\\Work\\$& $` $\' (local)\\日志.ndjson';el.textContent=log(path);
 const session=new LocalUi(root,()=>undefined,undefined,settingsLabels('copilot'),fallback);
 expect(el.textContent).toBe(`记录 Copilot 与智能体之间的后台消息，以便报告附带最近的活动记录。仅存储在本机的库外位置（${path}），可能包含明文提示词和笔记内容。`);
 el.textContent=log('/tmp/another (device)/frames.ndjson');session.scan();expect(el.textContent).toContain('（/tmp/another (device)/frames.ndjson）');session.stop();expect(el.textContent).toBe(log('/tmp/another (device)/frames.ndjson'));
 expect(settingsText('other',log(path),el)).toBeUndefined();expect(fallback(log('relative/path'),el)).toBeUndefined();expect(fallback(log('/tmp/a\nb'),el)).toBeUndefined();expect(fallback(log(path)+' Extra text',el)).toBeUndefined();
 const outside=new LocalUi(root,()=>undefined);expect(el.textContent).toBe(log('/tmp/another (device)/frames.ndjson'));outside.stop();
 const existing=new LocalUi(root,()=> '已有词典译文',undefined,settingsLabels('copilot'),fallback);expect(el.textContent).toBe('已有词典译文');existing.stop();
});
