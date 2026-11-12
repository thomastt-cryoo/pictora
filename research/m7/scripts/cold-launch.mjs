import {mkdtempSync,mkdirSync,copyFileSync,readdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PICTORA_PLAYWRIGHT_PATH ?? 'C:/Users/mazin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve('research/m7'),isolated=mkdtempSync(join(tmpdir(),'Pictora-M7-browser-')),records=[];
for(const [name,executablePath]of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
 const directory=join(isolated,name),profile=join(isolated,`${name}-profile`);mkdirSync(directory);mkdirSync(profile);copyFileSync('release/candidates/m7-browser/Pictora.html',join(directory,'Pictora.html'));
 const url=pathToFileURL(join(directory,'Pictora.html')).href,requests=[],errors=[],consoleMessages=[];let context;
 try{
  if(readdirSync(profile).length!==0)throw new Error('Profile not fresh');
  context=await chromium.launchPersistentContext(profile,{headless:true,chromiumSandbox:true,channel:name==='edge'?'msedge':'chrome',offline:true,viewport:{width:1440,height:900},acceptDownloads:true});
  await context.route('http://**/*',route=>route.abort());await context.route('https://**/*',route=>route.abort());
  const page=await context.newPage();page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))consoleMessages.push({type:m.type(),text:m.text()});});
  const start=performance.now();await page.goto(url);await page.waitForSelector('.app');for(let i=0;!page.workers().length&&i<100;i++)await page.waitForTimeout(20);const worker=page.workers()[0];if(!worker)throw new Error('No real processing worker');
  const capabilities=await worker.evaluate(async()=>{const canvas=new OffscreenCanvas(2,2),ctx=canvas.getContext('2d');ctx.fillStyle='#123456';ctx.fillRect(0,0,2,2);const bitmap=await createImageBitmap(canvas),data=[...ctx.getImageData(0,0,1,1).data];bitmap.close();return {OffscreenCanvas:typeof OffscreenCanvas,createImageBitmap:typeof createImageBitmap,data,handler:typeof self.onmessage,url:self.location.href};});
  const workerMs=performance.now()-start;await page.getByLabel('Source image file',{exact:true}).setInputFiles(resolve('research/m4/fixtures/portrait.jpg'));
  await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Export SVG"]');return b&&!b.disabled;},{},{timeout:60000});
  mkdirSync(join(root,'outputs',name),{recursive:true});for(const format of ['SVG','PNG']){const pending=page.waitForEvent('download');await page.getByRole('button',{name:`Export ${format}`,exact:true}).click();const file=await pending;await file.saveAs(join(root,'outputs',name,`cold-portrait.${format.toLowerCase()}`));if(await file.failure())throw new Error('Download failed');}
  await page.getByLabel('Interface theme').selectOption('dark');await page.screenshot({path:join(root,'screenshots',`${name}-cold-file-dark.png`)});await context.close();
  context=await chromium.launchPersistentContext(profile,{headless:true,chromiumSandbox:true,channel:name==='edge'?'msedge':'chrome',offline:true,viewport:{width:1440,height:900},acceptDownloads:true});const reopened=await context.newPage();reopened.on('request',r=>requests.push(r.url()));reopened.on('pageerror',e=>errors.push(e.message));await reopened.goto(url);await reopened.waitForSelector('.app');const savedTheme=await reopened.locator('html').getAttribute('data-theme');
  await reopened.getByLabel('Source image file',{exact:true}).setInputFiles(resolve('research/m4/fixtures/landscape.png'));await reopened.waitForFunction(()=>!document.querySelector('button[aria-label="Export SVG"]').disabled,{},{timeout:60000});await reopened.screenshot({path:join(root,'screenshots',`${name}-reopened-file.png`)});
  const external=requests.filter(url=>/^https?:/.test(url)),unexpectedFiles=requests.filter(request=>request.startsWith('file:')&&request!==url);if(external.length||unexpectedFiles.length||errors.length||consoleMessages.length)throw new Error('Unexpected request/error');
  records.push({browser:name,version:context.browser().version(),status:'PASS',url,profile,profileInitiallyEmpty:true,offlineBeforeNavigation:true,applicationDirectoryContents:readdirSync(directory),localServerRequired:false,workerMs,capabilities,reopened:true,savedTheme,requests,external,unexpectedFiles,errors,consoleMessages});console.log(`${name}: fresh-profile offline file launch, real worker, photo/export and full browser reopen PASS`);
 }catch(error){records.push({browser:name,status:'FAIL',error:error.stack,requests,errors,consoleMessages});throw error;}finally{if(context)await context.close();writeFileSync(join(root,'logs/cold-launch.json'),JSON.stringify({method:'Fresh persistent disk profile; offline:true supplied at browser context launch before file navigation; standalone HTML copied alone into OS temp directory. No project assets in that folder, no local HTTP server. Browser sandbox retained. Actual browser process closed/reopened with the same profile for storage/reopen check.',isolated,records},null,2)+'\n');}
}
