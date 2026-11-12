import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
export const {chromium}=require(process.env.PICTORA_PLAYWRIGHT_PATH ?? 'C:/Users/mazin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
export const root=resolve('research/m7'),base=process.env.M5_URL??pathToFileURL(resolve('release/candidates/m7-browser/Pictora.html')).href;
export const assert=(condition,message)=>{if(!condition)throw new Error(message);};
export const hash=value=>createHash('sha256').update(value).digest('hex');
export async function launch(name,{url=base,offline=url.startsWith('file:')}={}){
 const browser=await chromium.launch({headless:true,chromiumSandbox:true,channel:name==='edge'?'msedge':'chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light',acceptDownloads:true,offline}),errors=[],external=[],requests=[];
 await context.addInitScript(()=>{
  const NativeWorker=Worker,nativeBitmap=createImageBitmap,nativeUrl=URL.createObjectURL.bind(URL),nativeRevoke=URL.revokeObjectURL.bind(URL),nativeBlob=HTMLCanvasElement.prototype.toBlob;
  const audit=window.__m4={events:[],transfers:[],sent:[],received:[],workers:[],bitmaps:[],urls:new Set(),hold:false,held:[],faultNext:false,holdPng:false,encoders:[],unhandled:[],ticks:0};
  addEventListener('unhandledrejection',event=>audit.unhandled.push(String(event.reason)));
  window.createImageBitmap=async(...args)=>{const bitmap=await nativeBitmap(...args);audit.bitmaps.push(bitmap);return bitmap;};
  URL.createObjectURL=blob=>{const url=nativeUrl(blob);audit.urls.add(url);return url;};URL.revokeObjectURL=url=>{audit.urls.delete(url);return nativeRevoke(url);};
  HTMLCanvasElement.prototype.toBlob=function(callback,...args){if(audit.holdPng){audit.encoders.push(()=>nativeBlob.call(this,callback,...args));return;}return nativeBlob.call(this,callback,...args);};
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);const record={worker:this,terminated:false};audit.workers.push(record);this.addEventListener('message',event=>{if(event.__released)return;const data=event.data;audit.events.push({type:data.type,direction:"received",requestId:data.requestId,stage:data.stage,time:performance.now()});audit.received.push(data);if(audit.hold&&data.type==='segmentResult'){event.stopImmediatePropagation();audit.held.push({worker:this,data});}});}
   postMessage(message,...args){audit.events.push({type:message.type,direction:"sent",requestId:message.requestId,time:performance.now()});audit.sent.push({type:message.type,requestId:message.requestId,settings:message.settings,palette:message.palette,colorCount:message.colorCount,mode:message.mode});if(audit.faultNext){audit.faultNext=false;message.bitmap.close();queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'error',requestId:message.requestId,message:'Controlled QA processing failure'}})));return;}const bitmap=message.bitmap,before=bitmap?.width;const result=super.postMessage(message,...args);audit.transfers.push({type:message.type,before,after:bitmap?.width});return result;}
   terminate(){const record=audit.workers.find(record=>record.worker===this);if(record)record.terminated=true;return super.terminate();}
  };
  setInterval(()=>audit.ticks++,50);
 });
 context.on('page',page=>{page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{requests.push(request.url());const requestUrl=new URL(request.url());if(['http:','https:'].includes(requestUrl.protocol)&&requestUrl.origin!==new URL(url).origin)external.push(request.url());});});
 const page=await context.newPage();return {browser,context,page,errors,external,requests};
}
export async function fresh(page,theme='light'){await page.goto(base);await page.waitForSelector('.app');await page.getByLabel('Interface theme').selectOption(theme);}
export async function ready(page){await page.waitForFunction(()=>{const button=document.querySelector('button[aria-label="Export SVG"]');return !!document.querySelector('.preview-artwork > svg')&&button&&!button.disabled;},{},{timeout:60000});}
export async function upload(page,file,name,kind='source'){const payload=name?{name,mimeType:/\.jpe?g$/i.test(file)?'image/jpeg':'image/png',buffer:readFileSync(file)}:resolve(file);await page.getByLabel(kind==='source'?'Source image file':'Paint photo file',{exact:true}).setInputFiles(payload);}
export async function open(page,title){const section=page.locator('details.settings-section').filter({has:page.getByText(title,{exact:true})});if(await section.getAttribute('open')===null)await section.locator('summary').click();}
export async function range(page,label,value){await page.getByLabel(label,{exact:true}).evaluate((element,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,String(value));element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));},value);}
export async function download(page,name,format,file){mkdirSync(join(root,'outputs',name),{recursive:true});const pending=page.waitForEvent('download');await page.getByRole('button',{name:`Export ${format}`,exact:true}).click();const result=await pending;await result.saveAs(join(root,'outputs',name,file));assert(!(await result.failure()),'Failed download');return result.suggestedFilename();}
export async function snapshot(page){return page.evaluate(()=>{const model=[...window.__m4.received].reverse().find(message=>message.type==='segmentResult')?.model,request=[...window.__m4.sent].reverse().find(message=>message.type==='segment');return {model,request,svg:document.querySelector('.preview-artwork > svg')?.outerHTML,unhandled:window.__m4.unhandled};});}
