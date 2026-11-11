/** Verified settings typography only; never apply these selectors to chat views. */
export function settingsLabels(pluginId:string):string{
 if(pluginId!=='copilot')return '';
 return [
  'div.tw-text-sm.tw-font-medium.tw-leading-none',
  'div.tw-text-xs.tw-text-muted',
  'div.tw-text-sm.tw-text-muted',
  'div.tw-text-sm.tw-text-normal',
  'div.tw-text-lg.tw-font-semibold',
  'div.tw-text-xl.tw-font-bold',
  'span.tw-text-xs.tw-text-muted',
  'div.tw-text-xs.tw-text-faint',
  'div.tw-text-xs.tw-text-normal',
  'div.tw-text-smaller.tw-font-medium.tw-text-muted',
  'div.tw-text-ui-smaller.tw-text-muted',
  'div.tw-text-ui-smaller.tw-text-faint',
  'div.tw-font-mono.tw-text-smallest.tw-text-faint',
  'div.tw-text-ui-smaller.tw-bg-secondary-alt',
  'section.tw-border-interactive-accent.tw-text-sm > p',
  'section.tw-border-interactive-accent.tw-text-sm li',
  'div.tw-items-start.tw-text-muted > div',
  'div.tw-text-xs.tw-text-normal > div.tw-leading-relaxed',
  'th.tw-text-muted',
  'td[colspan].tw-text-muted',
  'div.tw-text-center.tw-text-muted.tw-p-8',
  'span.tw-text-base.tw-font-semibold',
  'a.tw-inline-flex.tw-text-sm.tw-text-accent'
 ].join(',');
}

/** Local fallbacks for verified Copilot sentences absent from the saved dictionary.
 * Slots are copied verbatim; fallback rendering makes no network requests.
 * Explicit supplementation can still collect the original label under the normal privacy rules.
 */
export function settingsText(pluginId:string,text:string,el:Element):string|undefined{
 if(pluginId!=='copilot')return;
 if(el.matches('span.tw-text-xs.tw-text-muted')&&/^\d{1,6} loaded$/.test(text))return text.replace(' loaded',' 项已加载');
 if(text==='loaded'&&el.matches('span.tw-text-xs.tw-text-muted')&&/^\d{1,6}\s+loaded$/.test(el.textContent?.trim()||''))return '项已加载';
 if(text==='Right-click'&&el.closest('th.tw-text-muted'))return '右键菜单';
 if(text==='Privacy-first.'&&el.matches('span.tw-font-semibold')&&el.parentElement?.matches('div.tw-leading-relaxed'))return '隐私优先。';
 if(text==='. Editing a file updates its command.'&&el.parentElement?.matches('div.tw-items-start.tw-text-muted'))return '。编辑文件即可更新对应命令。';
 if(text==='Fill in variables like {activenote}, {foldername}, or {#tag} in commands. Turn off to send commands exactly as written.'&&el.matches('div.tw-text-xs.tw-text-muted'))return '在命令中填入 {activenote}、{foldername} 或 {#tag} 等变量。关闭后按原文发送命令。';
 if(text==='add'&&el.querySelector('a[href^="https://www.obsidiancopilot.com/pricing"]'))return '提供';
 if(el.matches('div.tw-text-xs.tw-text-muted')&&['XDG_CONFIG_HOME','HTTPS_PROXY'].every(name=>[...el.querySelectorAll('code')].some(code=>code.textContent===name))){
  if(text==='or')return '或';
 }
 if(text==='. Re-enter your API keys in the relevant settings sections — each device has a separate Keychain.'&&el.matches('span.tw-text-warning')&&el.querySelector('strong')?.textContent==='Obsidian Keychain')return '。请在相应设置中重新输入 API 密钥；每台设备使用独立的钥匙串。';
 if(!el.matches('div.tw-text-xs.tw-text-muted'))return;
 const prefix='Records the behind-the-scenes messages between Copilot and the agent so a report always has recent activity to attach. Stored on this device only, outside your vault (';
 const suffix='), and can include your prompts and note contents in plain text.';
 if(!text.startsWith(prefix)||!text.endsWith(suffix))return;
 const path=text.slice(prefix.length,-suffix.length);
 if(!path||path.length>4096||/[\r\n\u0000]/.test(path)||!(/^[A-Za-z]:[\\/]/.test(path)||path.startsWith('/')))return;
 return `记录 Copilot 与智能体之间的后台消息，以便报告附带最近的活动记录。仅存储在本机的库外位置（${path}），可能包含明文提示词和笔记内容。`;
}

/** Only chrome of verified Copilot view types, never generic chat message text. */
export function chatLabels(pluginId:string,viewType:string):string{
 if(pluginId!=='copilot')return '';
 if(viewType==='copilot-agent-chat-view')return '.copilot-divider-t > div.tw-whitespace-pre-wrap.tw-text-ui-smaller.tw-text-muted';
 if(viewType==='copilot-chat-view')return ['.tw-relative > .tw-sr-only','.tw-relative > div.tw-pointer-events-none.tw-select-none.tw-absolute','[class~="tw-group/badge"] > span.tw-text-xs.tw-text-faint'].join(',');
 return '';
}

export function chatText(pluginId:string,viewType:string,text:string):string|undefined{
 if(pluginId!=='copilot'||viewType!=='copilot-agent-chat-view')return;
 for(const name of ['OpenCode','Claude','Codex'])if(text===`${name} isn't set up on this machine yet.`)return `此电脑尚未配置 ${name}。`;
}
