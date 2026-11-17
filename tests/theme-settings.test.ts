import {test,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
vi.mock('obsidian',()=>({parseYaml:(text:string)=>createRequire(import.meta.url)('js-yaml').load(text)}));
import {extractTheme,ThemeUi} from '../src/theme-settings';
import {defaultClock} from '../src/clock';

const css=`/* @settings
name: Test Theme
id: theme-section
settings:
  - id: layout
    type: heading
    title: Layout
    level: 1
  - id: width
    type: variable-select
    title: Content width
    description: >-
      Choose the width
      of your content.
    default: wide
    options:
      - label: Wide layout
        value: wide
      - Compact
  - id: secret
    type: variable-text
    title: 中文设置
    default: Private default
*/
body { --private: "Never translate CSS"; }
`;

test('extracts YAML UI fields including folded sections, without defaults, CSS or Chinese labels',()=>{
 const theme=extractTheme(css,'Test Theme','theme.css');
 expect(theme.entries.map(e=>e.text)).toEqual(['Layout','Content width','Choose the width of your content.','Wide layout','Compact']);
 expect(theme.entries.find(e=>e.text==='Wide layout')!.key).toContain('option:wide');
 expect(theme.entries.every(e=>e.context.includes('Test Theme'))).toBe(true);
 expect(extractTheme('body {}','Default','theme.css').entries).toEqual([]);
 expect(()=>extractTheme(css+css,'Duplicate','theme.css')).toThrow('重复');
 expect(()=>extractTheme('/* @settings\nid: [broken\n*/','Broken','theme.css')).toThrow('无法解析');
});

test('applies only identified theme rows, handles remount and restores dropdown values and listeners',()=>{
 const theme=extractTheme(css,'Test Theme','theme.css');const strings=Object.fromEntries(theme.entries.map(e=>[e.key,'中文 '+e.text]));
 const catalog:any={get:()=>({enabled:true,strings})};const ui=new ThemeUi(catalog,defaultClock);
 const root=document.createElement('div');document.body.append(root);
 root.innerHTML='<div class="setting-item style-settings-heading" data-level="0" data-id="theme-section">Test Theme</div><div class="style-settings-container"><div class="setting-item style-settings-heading" data-id="layout"><div class="setting-item-name"><span><svg></svg></span>Layout<span></span></div></div><div class="setting-item" data-id="width"><div class="setting-item-name">Content width</div><div class="setting-item-description">Choose the width of your content.</div><select><option value="wide">Wide layout</option><option value="Compact">Compact</option></select><input value="Content width"></div></div><div class="style-settings-heading" data-level="0" data-id="snippet">Snippet</div><div class="style-settings-container"><div class="setting-item" data-id="width"><div class="setting-item-name">Content width</div></div></div>';
 const select=root.querySelector('select')!;const changed=vi.fn();select.addEventListener('change',changed);
 try{
  ui.refresh([root],theme,'简体中文');expect(root.textContent).toContain('中文 Layout');expect(root.querySelector('option')!.textContent).toBe('中文 Wide layout');expect(select.value).toBe('wide');expect(changed).not.toHaveBeenCalled();
  expect(root.lastElementChild!.textContent).toBe('Content width');expect(root.querySelector('input')!.value).toBe('Content width');
  select.value='Compact';select.dispatchEvent(new Event('change'));expect(changed).toHaveBeenCalledTimes(1);
  const oldRow=root.querySelector('[data-id="layout"]')!;const replacement=oldRow.cloneNode(true)as HTMLElement;replacement.querySelector('.setting-item-name')!.textContent='Layout';oldRow.replaceWith(replacement);
  ui.refresh([root],theme,'简体中文');expect(replacement.textContent).toBe('中文 Layout');expect(oldRow.textContent).toBe('Layout');
  ui.release(document);expect(replacement.textContent).toBe('Layout');expect(select.value).toBe('Compact');
  ui.refresh([root],theme,'简体中文');expect(replacement.textContent).toBe('中文 Layout');
  ui.refresh([root],undefined,'简体中文');expect(replacement.textContent).toBe('Layout');expect(select.value).toBe('Compact');expect(select.options[0].textContent).toBe('Wide layout');
  const duplicate=root.firstElementChild!.cloneNode(true);root.append(duplicate);ui.refresh([root],theme,'简体中文');expect(select.options[0].textContent).toBe('Wide layout');
 }finally{ui.stop();root.remove();}
});
