import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname,join,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
const metadataBytes=process.argv[2]?readFileSync(process.argv[2]):execFileSync('cargo',['metadata','--locked','--manifest-path','src-tauri/Cargo.toml','--format-version','1','--filter-platform','x86_64-pc-windows-msvc'],{maxBuffer:16*1024*1024});
const metadata=JSON.parse(metadataBytes.toString('utf8').replace(/^\uFEFF/,''));
mkdirSync('.build-tools',{recursive:true});writeFileSync('.build-tools/windows-cargo-metadata.json',JSON.stringify(metadata)+'\n');
const parts=[readFileSync('release/browser/THIRD-PARTY-NOTICES.txt','utf8')];
for(const name of ['@tauri-apps/api']){
 const directory=resolve('node_modules',name),pkg=JSON.parse(readFileSync(join(directory,'package.json')));
 parts.push(`${name} ${pkg.version}\n${readdirSync(directory).filter(f=>/^LICENSE/i.test(f)).map(f=>readFileSync(join(directory,f),'utf8')).join('\n')}`);
}
parts.push('RUST DEPENDENCY ACKNOWLEDGEMENTS\nConservative inventory from the pinned Cargo.lock and Windows-target metadata; includes build-time dependencies. These source/build packages are not distributed as customer files.');
const records=[];
for(const pkg of metadata.packages.filter(p=>p.source).sort((a,b)=>a.name.localeCompare(b.name))){
 const directory=dirname(pkg.manifest_path),files=new Set(readdirSync(directory).filter(f=>/^(?:LICENSE|LICENCE|COPYING|COPYRIGHT|NOTICE)(?:[.-]|$)/i.test(f)&&statSync(join(directory,f)).isFile()));
 if(pkg.license_file&&existsSync(join(directory,pkg.license_file)))files.add(pkg.license_file);
 const texts=[...files].map(file=>`${basename(file)}\n${readFileSync(join(directory,file),'utf8').trim()}`);
 parts.push(`${pkg.name} ${pkg.version}\nLicense expression: ${pkg.license??'See included license'}\nSource: ${pkg.repository??pkg.source}\n${texts.join('\n\n')}`);
 records.push({name:pkg.name,version:pkg.version,license:pkg.license,licenseFiles:[...files]});
}
const nsis='build/licenses/NSIS-COPYING.txt';
parts.push(`NSIS installer components\n${readFileSync(nsis,'utf8')}`);
parts.push('MICROSOFT EDGE WEBVIEW2\nThe Windows application uses the separately licensed Microsoft Edge WebView2 Runtime. The offline installer includes Microsoft\'s signed standalone runtime installer, unmodified. Microsoft terms apply: https://developer.microsoft.com/microsoft-edge/webview2/ and https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution . Microsoft runtime files are not authored by Pictora.');
mkdirSync('release/windows',{recursive:true});writeFileSync('release/windows/THIRD-PARTY-NOTICES.txt',parts.join('\n\n'+'='.repeat(72)+'\n\n').replaceAll('\r\n','\n')+'\n');
mkdirSync('.build-tools',{recursive:true});writeFileSync('.build-tools/dependency-licenses.json',JSON.stringify({method:'Pinned Windows-target Cargo metadata; conservative full package notices, including build dependencies. Runtime npm notice texts and NSIS COPYING retained.',records},null,2)+'\n');
console.log(`Wrote notices for ${records.length} Rust packages, frontend dependencies and NSIS.`);
