import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const manifest=await json('manifest.json'),pkg=await json('package.json'),lock=await json('package-lock.json'),versions=await json('versions.json');
assert.equal(manifest.version,pkg.version);assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
assert.equal(versions[pkg.version],manifest.minAppVersion);assert.equal(manifest.isDesktopOnly,false);
assert.ok(manifest.description.length<=250&&manifest.description.endsWith('.'));assert.equal(manifest.author,'Tangerine.Cat');
assert.equal(pkg.license,'MIT');assert.match(await readFile('LICENSE','utf8'),/2026 Tangerine.Cat/);
const dir='dist/'+manifest.id,files=['main.js','manifest.json','styles.css'];
assert.deepEqual((await readdir(dir)).sort(),files.slice().sort());
assert.deepEqual(await json(dir+'/manifest.json'),manifest);
const meta=await json('dist/build-meta.json');
assert.ok(!Object.keys(meta.inputs).some(p=>/legacy-main|src\/dom\.ts|tests\/|qa\//.test(p)));
const bundle=await readFile(dir+'/main.js','utf8');
assert.ok(bundle.includes(await readFile('node_modules/acorn/LICENSE','utf8')),'Acorn license missing');
assert.ok(bundle.includes(await readFile('node_modules/@noble/hashes/LICENSE','utf8')),'noble-hashes license missing');
const module={exports:{}};
const mobileFiles=new Map(),secrets=new Map();
let mobileData=null,requests=0;
const mobileApi={
 Platform:{isDesktopApp:false,isMobile:true},normalizePath:path=>path,
 Plugin:class{
  constructor(app,manifest){this.app=app;this.manifest=manifest;}
  async loadData(){return mobileData;}
  async saveData(data){mobileData=structuredClone(data);}
  addStatusBarItem(){throw Error('Mobile status bar unavailable');}
  addSettingTab(){} addCommand(){} registerEvent(){}
 },
 PluginSettingTab:class{},Modal:class{},Notice:class{constructor(message){throw Error(message);}},
 async requestUrl(args){requests++;const items=JSON.parse(JSON.parse(args.body).messages[1].content);return {status:200,json:{choices:[{message:{content:JSON.stringify(Object.fromEntries(items.map(i=>[i.id,'打开'])))}}]}};}
};
runInNewContext(bundle,{
 module,exports:module.exports,TextEncoder,crypto:webcrypto,AbortController,URL,
 window:{setTimeout,clearTimeout},
 require(name){
  assert.equal(name,'obsidian','Plugin initialization must not load desktop modules');
  return mobileApi;
 }
},{filename:'main.js',timeout:2000});
assert.equal(typeof module.exports.default,'function');
const mobileApp={
 secretStorage:{getSecret:id=>secrets.get(id)??null,setSecret:(id,value)=>secrets.set(id,value)},
 vault:{configDir:'custom-config',adapter:{
  exists:async path=>mobileFiles.has(path),read:async path=>mobileFiles.get(path),
  write:async(path,data)=>{mobileFiles.set(path,data);},
  process:async(path,fn)=>{const data=fn(mobileFiles.get(path));mobileFiles.set(path,data);return data;}
 }},
 plugins:{manifests:{fixture:{id:'fixture',name:'Fixture',version:'1.0.0'}}},
 workspace:{on(){},onLayoutReady(){},iterateAllLeaves(){}}
};
mobileFiles.set('custom-config/plugins/fixture/main.js','x.setName("Open");');
let mobile=new module.exports.default(mobileApp,manifest);
await mobile.onload();
await mobile.saveService('custom',{apiKey:'SYNTHETIC-MOBILE-CHECK',baseUrl:'https://example.invalid/v1',model:'test',plan:'free'});
assert.ok(!JSON.stringify(mobileData).includes('SYNTHETIC-MOBILE-CHECK'));
assert.equal(secrets.get(mobileData.profiles.custom.secretName),'SYNTHETIC-MOBILE-CHECK');
await mobile.translatePlugin('fixture');
assert.equal(mobile.catalog.get('fixture','简体中文').strings.Open,'打开');
assert.equal(requests,1);
mobile.onunload();
mobile=new module.exports.default(mobileApp,manifest);
await mobile.onload();
assert.equal((await mobile.translatePlugin('fixture')).translated,0);
assert.equal(requests,1);
mobile.onunload();
assert.ok(mobileFiles.has('custom-config/plugins/chinese-ui-translator/translations.json'));
assert.ok([...mobileFiles.keys()].some(p=>/progress-[a-f0-9]{64}\.json$/.test(p)));
assert.ok(!/FAKE-LEGACY-KEY|KeepMe-123|sk-[a-zA-Z0-9]{20,}|E:\\\\00/.test(bundle),'Fixture or private content in bundle');
const evidence={version:pkg.version,node:process.version,files:await Promise.all(files.map(async name=>{const data=await readFile(dir+'/'+name);return{name,size:data.length,sha256:createHash('sha256').update(data).digest('hex')};})),inputs:Object.keys(meta.inputs)};
await mkdir('dist',{recursive:true});await writeFile('dist/release-check.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
