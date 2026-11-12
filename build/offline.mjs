import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createZip} from './zip.mjs';
import {compatibilityGate} from './compatibility.mjs';

export async function buildOffline({outputDirectory=resolve('release/browser')}={}){
 const previousEnvironment=process.env.NODE_ENV;
 let result;
 try{
  // Packaging always produces a production React build, including when invoked
  // by a test runner whose own NODE_ENV is "test".
  process.env.NODE_ENV='production';
  result=await build({configFile:false,mode:'production',base:'./',plugins:[react()],resolve:{alias:[{find:'../workers/createWorker',replacement:resolve('build/offline-worker.ts')}]},worker:{format:'iife'},build:{write:false,modulePreload:false,cssCodeSplit:false,sourcemap:false,rollupOptions:{output:{inlineDynamicImports:true}}}});
 }finally{if(previousEnvironment===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousEnvironment;}
 const output=result.output,script=output.filter(file=>file.type==='chunk'),styles=output.filter(file=>file.type==='asset'&&file.fileName.endsWith('.css')),entry=output.find(file=>file.type==='asset'&&file.fileName==='index.html');
 if(script.length!==1||styles.length!==1||!entry||output.length!==3||script[0].imports.length||script[0].dynamicImports.length)throw new Error('Offline package has unexpected external chunks/assets');
 let html=String(entry.source).replaceAll('\r\n','\n'),scriptCount=0,styleCount=0;
 html=html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,(tag,src)=>{if(!src.endsWith(script[0].fileName))throw new Error('Unknown script asset');scriptCount++;return `<script type="module">${compatibilityGate}${script[0].code.replace(/<\/script/gi,'<\\/script')}\n}</script>`;});
 html=html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g,tag=>{if(!tag.includes(styles[0].fileName))throw new Error('Unknown stylesheet');styleCount++;return `<style>${styles[0].source}</style>`;});
 if(scriptCount!==1||styleCount!==1||/<(?:script[^>]+src|link[^>]+href)\s*=/i.test(html)||/url\(\s*["']?(?:https?:|\/\/|\/assets)/i.test(html))throw new Error('Unresolved external resource');
 const dependencyNames=['react','react-dom','scheduler','zustand','use-sync-external-store','loose-envify','js-tokens'];
 const notices=dependencyNames.map(name=>{const pkg=JSON.parse(readFileSync(`node_modules/${name}/package.json`,'utf8')),license=readFileSync(`node_modules/${name}/LICENSE`,'utf8').replaceAll('\r\n','\n');return `${name} ${pkg.version}\n${license.trim()}\n`;}).join('\n'+'='.repeat(72)+'\n\n');
 html=html.replace('</head>',`<!-- Pictora third-party notices\n${notices.replaceAll('-->','-- >')}-->\n</head>`);
 const entries=[{name:'Pictora.html',data:Buffer.from(html)},{name:'README.txt',data:Buffer.from(readFileSync('build/README-browser.txt','utf8').replaceAll('\r\n','\n'))},{name:'THIRD-PARTY-NOTICES.txt',data:Buffer.from(notices)}];
 const zip=createZip(entries),directory=resolve(outputDirectory);mkdirSync(directory,{recursive:true});for(const entry of entries)writeFileSync(resolve(directory,entry.name),entry.data);writeFileSync(resolve(directory,'Pictora-Browser-Offline.zip'),zip);
 return {directory,files:[...entries,{name:'Pictora-Browser-Offline.zip',data:zip}].map(file=>({name:file.name,bytes:file.data.length,sha256:createHash('sha256').update(file.data).digest('hex')})),zipContents:entries.map(file=>file.name),dependenciesAdded:[],method:'Vite in-memory build; one inline module, inline CSS, same pbn.worker.ts via Vite classic inline Blob worker; deterministic ZIP with Node builtins.'};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('build/offline.mjs')){const start=performance.now(),result=await buildOffline();console.log(JSON.stringify({...result,buildMs:performance.now()-start},null,2));}
