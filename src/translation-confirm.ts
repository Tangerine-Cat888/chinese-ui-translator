import {Modal,Setting,type App} from 'obsidian';

export function confirmLargeTranslation(app:App,count:number,signal:AbortSignal):Promise<boolean>{
 if(count<=3000)return Promise.resolve(!signal.aborted);
 return new Promise(resolve=>{
  class Confirmation extends Modal {
   private accepted=false;
   onOpen(){
    this.setTitle('翻译词条较多');
    this.contentEl.dataset.baIgnore='';
    this.contentEl.createEl('p',{text:`本次需翻译 ${count} 条词条，耗时较长，并将消耗更多翻译服务额度。`});
    this.contentEl.createEl('p',{text:'已完成的进度会自动保存，中断后可继续翻译。'});
    new Setting(this.contentEl).addButton(b=>b.setButtonText('取消翻译').onClick(()=>this.close())).addButton(b=>b.setButtonText('继续翻译').setCta().onClick(()=>{this.accepted=true;this.close();}));
   }
   onClose(){signal.removeEventListener('abort',cancel);resolve(this.accepted&&!signal.aborted);}
  }
  const modal=new Confirmation(app);
  const cancel=()=>modal.close();
  if(signal.aborted){resolve(false);return;}
  signal.addEventListener('abort',cancel,{once:true});modal.open();
 });
}
