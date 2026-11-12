import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerRequest } from './messages';
const mocks=vi.hoisted(()=>({decode:vi.fn()}));
vi.mock('../pipeline/loadImage',()=>({bitmapToPixelData:mocks.decode}));
let context:{onmessage:(event:MessageEvent<WorkerRequest>)=>void;postMessage:ReturnType<typeof vi.fn>};
beforeEach(async()=>{vi.resetModules();context={onmessage:()=>{},postMessage:vi.fn()};vi.stubGlobal('self',context);await import('./pbn.worker');});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe('transferred worker bitmap ownership',()=>{
  it('releases a bitmap exactly once even when canvas decoding throws',()=>{
    mocks.decode.mockImplementation(()=>{throw new Error('OffscreenCanvas missing');});const bitmap={close:vi.fn()} as unknown as ImageBitmap;
    context.onmessage({data:{type:'generatePalette',requestId:1,bitmap,colorCount:12,mode:'source'}} as MessageEvent<WorkerRequest>);
    expect(bitmap.close).toHaveBeenCalledOnce();expect(context.postMessage.mock.calls[0][0]).toMatchObject({type:'error',requestId:1});
  });
  it('releases successful palette requests once and uses the real corrected palette engine',()=>{
    mocks.decode.mockReturnValue({width:2,height:1,data:new Uint8ClampedArray([180,80,45,255,180,80,45,255])});const bitmap={close:vi.fn()} as unknown as ImageBitmap;
    context.onmessage({data:{type:'generatePalette',requestId:2,bitmap,colorCount:36,mode:'source'}} as MessageEvent<WorkerRequest>);
    expect(bitmap.close).toHaveBeenCalledOnce();expect(context.postMessage.mock.calls[0][0]).toMatchObject({type:'paletteResult',palette:[{number:1,r:180,g:80,b:45}]});
  });
});
