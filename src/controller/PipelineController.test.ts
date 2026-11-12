import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineController, CancelledOperation, statusText, type WorkerPort } from './PipelineController';
import { captureExport, exportIsCurrent } from './exportSnapshot';
import { canExport, modelOwner, useStore } from '../state/store';
import { buildRegionModel } from '../pipeline/buildModel';
import type { WorkerRequest, WorkerResponse } from '../workers/messages';
import type { PaletteColor } from '../pipeline/types';

const palette: PaletteColor[]=[{number:1,r:0,g:0,b:0},{number:2,r:255,g:255,b:255}];
function bitmap(name='bitmap') {return {width:4,height:4,close:vi.fn(),name} as unknown as ImageBitmap;}
function deferred<T>() {let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage']=null;onerror:WorkerPort['onerror']=null;onmessageerror:WorkerPort['onmessageerror']=null;
  sent: WorkerRequest[]=[];terminate=vi.fn();postMessage=vi.fn((request:WorkerRequest)=>{this.sent.push(request);});
  reply(message:WorkerResponse){this.onmessage?.({data:message} as MessageEvent<WorkerResponse>);}
}
function result(request: Extract<WorkerRequest,{type:'segment'}>) {
  return buildRegionModel({width:4,height:4,data:new Uint8ClampedArray(Array.from({length:16},()=>[0,0,0,255]).flat())},request.palette,request.settings);
}
let workers:FakeWorker[],controller:PipelineController,clones:ImageBitmap[];
function start(options:Partial<ConstructorParameters<typeof PipelineController>[0]>={}) {
  controller=new PipelineController({workerFactory:()=>{const worker=new FakeWorker();workers.push(worker);return worker;},cloneBitmap:async()=>{const clone=bitmap('clone');clones.push(clone);return clone;},decodeBitmap:async()=>bitmap('decoded'),timeoutMs:5000,...options});controller.start();return controller;
}
function manualSource(name='A.png') {const state=useStore.getState();state.setPaletteMode('manual');state.setPalette(palette);state.setSource(bitmap(name),name);}
async function advance(ms=250){await vi.advanceTimersByTimeAsync(ms);await Promise.resolve();}
function last<T>(items:T[]){return items[items.length-1];}
function latestSegment(){return last(last(workers).sent.filter((request):request is Extract<WorkerRequest,{type:'segment'}>=>request.type==='segment'));}
function replySegment(request=latestSegment(),worker=last(workers)){worker.reply({type:'segmentResult',requestId:request.requestId,model:result(request)});}
async function ready(){manualSource();start();await advance();replySegment();await Promise.resolve();expect(canExport(useStore.getState())).toBe(true);}
beforeEach(()=>{vi.useFakeTimers();useStore.setState(useStore.getInitialState(),true);workers=[];clones=[];});
afterEach(()=>{controller?.dispose();vi.useRealTimers();});

describe('source and export ownership',()=>{
  it('invalidates output immediately at selection, before decode and debounce',async()=>{
    await ready();const previous=useStore.getState().sourceBitmap!,decode=deferred<ImageBitmap>();
    controller.dispose();useStore.setState(useStore.getInitialState(),true);manualSource();start({decodeBitmap:()=>decode.promise});await advance();replySegment();await Promise.resolve();
    const selected=controller.loadSource({name:'B.png'} as File);const settled=selected.catch(error=>error);
    expect(canExport(useStore.getState())).toBe(false);expect(useStore.getState().svg).toBeNull();expect(useStore.getState().status).toBe('decoding-source');
    decode.resolve(bitmap('B'));await selected;await advance();
    last(workers).reply({type:'progress',requestId:latestSegment().requestId,stage:'Done',fraction:1});
    expect(useStore.getState().status).toBe('segment');expect(canExport(useStore.getState())).toBe(false);
    expect(statusText(useStore.getState().status,useStore.getState().progressStage)).toBe('Preparing preview');
    replySegment();await Promise.resolve();
    expect(captureExport(useStore.getState())?.basename).toBe('B');expect(useStore.getState().modelOwner?.sourceName).toBe('B.png');await settled;
    expect(previous.close).toHaveBeenCalled();
  });
  for(const mutation of ['smoothing','palette','count','mode'] as const)it(`invalidates the cached export synchronously for ${mutation}`,async()=>{
    await ready();const state=useStore.getState();
    if(mutation==='smoothing')state.setSegmentation({smoothing:55});
    if(mutation==='palette')state.updatePaletteColor(0,{r:10});
    if(mutation==='count'){state.setPaletteMode('source');state.setColorCount(36);}
    if(mutation==='mode')state.setPaletteMode('source');
    expect(canExport(useStore.getState())).toBe(false);expect(captureExport(useStore.getState())).toBeNull();expect(useStore.getState().svg).toBeNull();
  });
  it('render-only changes reuse the valid model and invalidate only an old export snapshot',async()=>{
    await ready();const before=useStore.getState().model,snapshot=captureExport(useStore.getState())!,requests=workers[0].sent.length;
    useStore.getState().setRender({outputWidth:600,backgroundColor:'#abcdef'});
    expect(useStore.getState().model).toBe(before);expect(canExport(useStore.getState())).toBe(true);expect(exportIsCurrent(useStore.getState(),snapshot)).toBe(false);
    expect(useStore.getState().svgWidth).toBe(600);await advance(600);expect(workers[0].sent.length).toBe(requests);
  });
  it('old segment results/progress/errors are ignored in the pre-debounce interval',async()=>{
    manualSource();start();await advance();const old=latestSegment();useStore.getState().setSegmentation({smoothing:60});
    workers[0].reply({type:'progress',requestId:old.requestId,stage:'obsolete',fraction:.99});workers[0].reply({type:'error',requestId:old.requestId,message:'obsolete'});replySegment(old);
    await Promise.resolve();expect(useStore.getState().model).toBeNull();expect(useStore.getState().error).toBeNull();expect(useStore.getState().progressStage).not.toBe('obsolete');
    await advance();replySegment();await Promise.resolve();expect(canExport(useStore.getState())).toBe(true);
  });
  it('rapid A to B to C decoding accepts only C and closes late A/B bitmaps',async()=>{
    const a=deferred<ImageBitmap>(),b=deferred<ImageBitmap>(),c=deferred<ImageBitmap>();start({decodeBitmap:file=>({A:a,B:b,C:c}[file.name as 'A'|'B'|'C'].promise)});
    const pa=controller.loadSource({name:'A'} as File).catch(error=>error),pb=controller.loadSource({name:'B'} as File).catch(error=>error),pc=controller.loadSource({name:'C'} as File);
    expect(await pa).toBeInstanceOf(CancelledOperation);expect(await pb).toBeInstanceOf(CancelledOperation);
    const ca=bitmap('A'),cb=bitmap('B'),cc=bitmap('C');c.resolve(cc);await pc;b.resolve(cb);a.resolve(ca);await Promise.resolve();await Promise.resolve();
    expect(useStore.getState().sourceBitmap).toBe(cc);expect(useStore.getState().sourceName).toBe('C');expect(ca.close).toHaveBeenCalledOnce();expect(cb.close).toHaveBeenCalledOnce();
  });
  it('older ImageBitmap clones completing after a newer request are never posted',async()=>{
    const old=deferred<ImageBitmap>();let count=0;manualSource();start({cloneBitmap:()=>++count===1?old.promise:Promise.resolve(bitmap('newclone'))});await advance();
    useStore.getState().setSegmentation({smoothing:70});await advance();expect(workers[0].sent).toHaveLength(1);const request=latestSegment();
    const late=bitmap('late');old.resolve(late);await Promise.resolve();await Promise.resolve();expect(late.close).toHaveBeenCalledOnce();expect(workers[0].sent).toHaveLength(1);
    replySegment(request);await Promise.resolve();expect(canExport(useStore.getState())).toBe(true);
  });
});

describe('palette request ownership and settlement',()=>{
  it('worker palette errors settle and expose a recoverable error instead of hanging',async()=>{
    useStore.getState().setSource(bitmap(),'A.png');start();await advance(200);const request=workers[0].sent[0];
    workers[0].reply({type:'error',requestId:request.requestId,message:'palette failure'});await Promise.resolve();await Promise.resolve();
    expect(useStore.getState().status).toBe('failed');expect(useStore.getState().busy).toBe(false);expect(useStore.getState().error).toContain('colors');expect(controller.diagnostics().pendingRequests).toBe(0);
    controller.retry();await advance(200);const retry=last(workers[0].sent);workers[0].reply({type:'paletteResult',requestId:retry.requestId,palette});await Promise.resolve();await advance();replySegment();await Promise.resolve();expect(canExport(useStore.getState())).toBe(true);
  });
  it('out-of-order source palette replies cannot overwrite the latest count',async()=>{
    useStore.getState().setSource(bitmap(),'A.png');start();await advance(200);const old=workers[0].sent[0];
    useStore.getState().setColorCount(2);await advance(200);const current=last(workers[0].sent);
    workers[0].reply({type:'paletteResult',requestId:current.requestId,palette});await Promise.resolve();
    workers[0].reply({type:'paletteResult',requestId:old.requestId,palette:[{number:1,r:255,g:0,b:0}]});await Promise.resolve();
    expect(useStore.getState().palette).toEqual(palette);expect(useStore.getState().error).toBeNull();
  });
  it('switching to manual settles an outstanding palette promise and rejects its old error',async()=>{
    useStore.getState().setSource(bitmap(),'A.png');start();await advance(200);const old=workers[0].sent[0];
    useStore.getState().setPaletteMode('manual');useStore.getState().setPalette(palette);
    workers[0].reply({type:'error',requestId:old.requestId,message:'obsolete'});await Promise.resolve();await advance();replySegment();await Promise.resolve();
    expect(useStore.getState().error).toBeNull();expect(canExport(useStore.getState())).toBe(true);expect(controller.diagnostics().pendingRequests).toBe(0);
  });
  it('editing a palette during generation cancels the automatic overwrite',async()=>{
    useStore.getState().setPalette(palette);useStore.getState().setSource(bitmap(),'A.png');useStore.getState().setPalette(palette);start();
    useStore.getState().setColorCount(36);await advance(200);const old=workers[0].sent[0];useStore.getState().updatePaletteColor(0,{r:99});
    workers[0].reply({type:'paletteResult',requestId:old.requestId,palette});await Promise.resolve();expect(useStore.getState().palette[0].r).toBe(99);expect(useStore.getState().paletteReady).toBe(true);
  });
  it('paint-photo A then B accepts only B and ignores stale A palette replies',async()=>{
    manualSource();useStore.getState().setPaletteMode('paints');start();await controller.loadPaints({name:'A.png'} as File);await advance(250);const old=workers[0].sent[0];
    await controller.loadPaints({name:'B.png'} as File);await advance(250);const current=last(workers[0].sent);
    workers[0].reply({type:'paletteResult',requestId:current.requestId,palette});await Promise.resolve();workers[0].reply({type:'paletteResult',requestId:old.requestId,palette:[{number:1,r:255,g:0,b:0}]});await Promise.resolve();
    expect(useStore.getState().palette).toEqual(palette);expect(useStore.getState().paintsName).toBe('B.png');
  });
  it('no visible colors ends processing with a practical file action',async()=>{
    useStore.getState().setSource(bitmap(),'empty.png');start();await advance(200);const request=workers[0].sent[0];workers[0].reply({type:'paletteResult',requestId:request.requestId,palette:[]});await Promise.resolve();await Promise.resolve();
    expect(useStore.getState().busy).toBe(false);expect(useStore.getState().error).toContain('no visible colors');expect(useStore.getState().errorAction).toBe('source');
  });
});

describe('failure, recovery and lifecycle resources',()=>{
  for(const kind of ['source','paints'] as const)it(`handles ${kind} decode errors and recovers without restart`,async()=>{
    let fail=true;start({decodeBitmap:async()=>{if(fail)throw new Error('corrupt');return bitmap();}});if(kind==='paints')useStore.getState().setPaletteMode('paints');
    await expect(kind==='source'?controller.loadSource({name:'bad'} as File):controller.loadPaints({name:'bad'} as File)).rejects.toThrow('corrupt');
    expect(useStore.getState().busy).toBe(false);expect(useStore.getState().errorScope).toBe(kind);expect(controller.diagnostics().pendingDecodes).toBe(0);
    fail=false;await (kind==='source'?controller.loadSource({name:'good'} as File):controller.loadPaints({name:'good'} as File));expect(useStore.getState().error).toBeNull();
  });
  it('a clone failure is surfaced and the next attempt can succeed',async()=>{
    let fail=true;manualSource();start({cloneBitmap:async()=>{if(fail)throw new Error('clone failed');return bitmap();}});await advance();expect(useStore.getState().status).toBe('failed');expect(useStore.getState().busy).toBe(false);
    fail=false;controller.retry();await advance();replySegment();await Promise.resolve();expect(canExport(useStore.getState())).toBe(true);
  });
  it('worker runtime errors reject all promises, stop busy state and restart on retry',async()=>{
    manualSource();start();await advance();const old=workers[0],oldHandler=old.onmessage!;old.onerror?.({preventDefault:vi.fn()} as unknown as ErrorEvent);await Promise.resolve();await Promise.resolve();
    expect(useStore.getState().errorScope).toBe('worker');expect(useStore.getState().busy).toBe(false);expect(controller.diagnostics().pendingRequests).toBe(0);expect(old.terminate).toHaveBeenCalledOnce();
    controller.retry();await advance();expect(workers).toHaveLength(2);oldHandler({data:{type:'error',requestId:1,message:'late old worker'}} as MessageEvent<WorkerResponse>);replySegment();await Promise.resolve();expect(canExport(useStore.getState())).toBe(true);
  });
  it('message decoding errors fail current processing cleanly',async()=>{
    manualSource();start();await advance();workers[0].onmessageerror?.({} as MessageEvent);await Promise.resolve();await Promise.resolve();expect(useStore.getState().status).toBe('failed');expect(controller.diagnostics().pendingRequests).toBe(0);
  });
  it('a silent worker has a bounded timeout and can be retried',async()=>{
    manualSource();start();await advance();await advance(5000);expect(useStore.getState().busy).toBe(false);expect(useStore.getState().errorScope).toBe('worker');expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
  it('worker construction errors do not leave a pending operation',async()=>{
    manualSource();start({workerFactory:()=>{throw new Error('unsupported');}});await advance();expect(useStore.getState().status).toBe('failed');expect(controller.diagnostics().pendingRequests).toBe(0);
  });
  it('dispose settles pending palette promises, clears timers and releases inputs',async()=>{
    useStore.getState().setSource(bitmap(),'A.png');const source=useStore.getState().sourceBitmap!;start();await advance(200);
    controller.dispose();await Promise.resolve();expect(controller.diagnostics()).toEqual({pendingRequests:0,pendingDecodes:0,paletteTimer:false,segmentTimer:false,disposed:true});expect(source.close).toHaveBeenCalledOnce();expect(useStore.getState().busy).toBe(false);
  });
  it('dispose rejects decoding immediately and closes the eventual native result',async()=>{
    const decode=deferred<ImageBitmap>();start({decodeBitmap:()=>decode.promise});const promise=controller.loadSource({name:'A'} as File).catch(error=>error);controller.dispose();expect(await promise).toBeInstanceOf(CancelledOperation);
    const late=bitmap();decode.resolve(late);await Promise.resolve();await Promise.resolve();expect(late.close).toHaveBeenCalledOnce();
  });
  it('switching away from paints cancels a still-decoding photo',async()=>{
    const decode=deferred<ImageBitmap>();start({decodeBitmap:()=>decode.promise});useStore.getState().setPaletteMode('paints');const promise=controller.loadPaints({name:'A'} as File).catch(error=>error);useStore.getState().setPaletteMode('manual');expect(await promise).toBeInstanceOf(CancelledOperation);
    const late=bitmap();decode.resolve(late);await Promise.resolve();expect(late.close).toHaveBeenCalledOnce();expect(useStore.getState().paintsLoading).toBe(false);
  });
  it('obsolete export errors cannot replace the new source state',async()=>{
    await ready();const snapshot=captureExport(useStore.getState())!;useStore.getState().beginSource('B.png');useStore.getState()._setExportError('old PNG failed',snapshot.owner,snapshot.renderRevision);expect(useStore.getState().error).toBeNull();
  });
  it('export failures retain the valid cached model and allow a retry',async()=>{
    await ready();const snapshot=captureExport(useStore.getState())!;useStore.getState()._setExportError('PNG failed',snapshot.owner,snapshot.renderRevision);
    expect(canExport(useStore.getState())).toBe(true);expect(useStore.getState().errorScope).toBe('export');useStore.getState().dismissError();expect(useStore.getState().error).toBeNull();
  });
  it('independent paint completion does not erase a current source decode failure',async()=>{
    useStore.getState().setPaletteMode('paints');const revision=useStore.getState().beginPaints('paint.png');useStore.getState()._fail('source','Bad source','source');useStore.getState().completePaints(bitmap(),revision);expect(useStore.getState().errorScope).toBe('source');expect(useStore.getState().status).toBe('failed');
  });
  it('same settings and render changes never trigger duplicate processing',async()=>{
    await ready();const before=workers[0].sent.length;useStore.getState().setSegmentation({smoothing:40});useStore.getState().setColorCount(12);useStore.getState().setRender({labelFontSize:20});await advance(1000);expect(workers[0].sent.length).toBe(before);expect(modelOwner(useStore.getState())).toEqual(useStore.getState().modelOwner);
  });
});
