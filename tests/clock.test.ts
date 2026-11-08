// @vitest-environment jsdom
import {test,expect,vi} from 'vitest';
import {defaultClock,yieldToUi} from '../src/clock';

test('scheduled work belongs to the main window and survives a child window closing',async()=>{
 const frame=document.createElement('iframe');document.body.append(frame);
 const scheduled=vi.spyOn(window,'setTimeout');
 try {
  const ran=vi.fn();
  const completed=new Promise<void>(resolve=>defaultClock.set(()=>{ran();resolve();},10));
  frame.remove();
  await completed;
  expect(scheduled).toHaveBeenCalled();
  expect(ran).toHaveBeenCalledOnce();
 }finally{scheduled.mockRestore();frame.remove();}
});

test('cancelling queued work prevents a callback after its session closes',async()=>{
 const ran=vi.fn();const cancel=defaultClock.set(ran,5);cancel();
 await new Promise<void>(resolve=>window.setTimeout(resolve,20));
 expect(ran).not.toHaveBeenCalled();
});

test('scan yielding uses a browser task and closes both message ports',async()=>{
 const close1=vi.fn(),close2=vi.fn();let deliver:()=>void=()=>{};
 class Channel {
  port1={onmessage:null as null|(()=>void),close:close1};
  port2={close:close2,postMessage:()=>{deliver=()=>this.port1.onmessage?.();}};
 }
 const old=window.MessageChannel;
 Object.defineProperty(window,'MessageChannel',{configurable:true,writable:true,value:Channel});
 try {
  let finished=false;const task=yieldToUi().then(()=>{finished=true;});
  expect(finished).toBe(false);deliver();await task;
  expect(finished).toBe(true);expect(close1).toHaveBeenCalledOnce();expect(close2).toHaveBeenCalledOnce();
 }finally{Object.defineProperty(window,'MessageChannel',{configurable:true,writable:true,value:old});}
});
