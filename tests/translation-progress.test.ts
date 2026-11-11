import {test,expect} from 'vitest';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {ProgressStore} from '../src/translation-progress';

test('checkpoint roundtrips independently of active dictionaries and rejects malformed progress without overwriting it',async()=>{
 const directory=resolve('tests/artifacts','progress-'+Date.now());
 const store=new ProgressStore(directory,'fixture','简体中文');
 expect(await store.load()).toBeUndefined();
 const value={sourceHash:'source',configHash:'config',items:[{text:'First label',role:'label',value:'第一项'},{text:'Found ⟦BA0⟧ items',role:'description'}]};
 await store.save(value);expect(await store.load()).toEqual(value);
 const files=await readdir(directory);expect(files).toHaveLength(1);expect(files[0]).toMatch(/^progress-/);
 const file=join(directory,files[0]);
 for(const bad of [{...value,items:[{text:'First label',role:'invalid'}]},{...value,items:[{text:'Found ⟦BA0⟧ items',role:'description',value:'未保留数字'}]},null]){
  const bytes=JSON.stringify(bad);await writeFile(file,bytes);await expect(store.load()).rejects.toThrow();expect(await readFile(file,'utf8')).toBe(bytes);
 }
});
