import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, svgToPngBlob } from './toPNG';

let image: FakeImage, canvas: { width:number; height:number; getContext:ReturnType<typeof vi.fn>; toBlob:ReturnType<typeof vi.fn> }, anchor: { href:string; download:string; click:ReturnType<typeof vi.fn>; remove:ReturnType<typeof vi.fn> };
class FakeImage { width=0;height=0;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;value='';constructor(){image=this;}set src(value:string){this.value=value;if(value)queueMicrotask(()=>this.onload?.());}get src(){return this.value;} }
beforeEach(()=>{
  vi.useFakeTimers();
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:export');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  canvas={width:0,height:0,getContext:vi.fn(()=>({drawImage:vi.fn()})),toBlob:vi.fn((callback:(blob:Blob|null)=>void)=>callback(new Blob(['png'],{type:'image/png'})))};
  anchor={href:'',download:'',click:vi.fn(),remove:vi.fn()};
  vi.stubGlobal('Image',FakeImage);vi.stubGlobal('document',{createElement:(tag:string)=>tag==='canvas'?canvas:anchor,body:{appendChild:vi.fn()}});
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('PNG/export lifecycle without changing rasterization semantics',()=>{
  it('keeps image/canvas dimensions and PNG MIME while releasing resources after success',async()=>{
    const pending=svgToPngBlob('<svg/>',1600,1200);await vi.advanceTimersByTimeAsync(0);const blob=await pending;
    expect(blob.type).toBe('image/png');expect(image.width).toBe(1600);expect(image.height).toBe(1200);expect(canvas.toBlob.mock.calls[0][1]).toBe('image/png');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');expect(canvas.width).toBe(0);expect(canvas.height).toBe(0);expect(vi.getTimerCount()).toBe(0);
  });
  it('aborting a pending encoder settles promptly and revokes its SVG URL',async()=>{
    canvas.toBlob.mockImplementation(()=>{});const controller=new AbortController();const pending=svgToPngBlob('<svg/>',600,450,controller.signal).catch(error=>error);await vi.advanceTimersByTimeAsync(0);controller.abort();
    expect((await pending).name).toBe('AbortError');expect(URL.revokeObjectURL).toHaveBeenCalledOnce();expect(canvas.width).toBe(0);expect(vi.getTimerCount()).toBe(0);
  });
  it('unavailable canvas fails cleanly and releases its URL',async()=>{
    canvas.getContext.mockReturnValue(null);const pending=svgToPngBlob('<svg/>',600,450).catch(error=>error);await vi.advanceTimersByTimeAsync(0);expect((await pending).message).toContain('2D context');expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it('a failed blob encoder does not leave a pending export',async()=>{
    canvas.toBlob.mockImplementation(callback=>callback(null));const pending=svgToPngBlob('<svg/>',600,450).catch(error=>error);await vi.advanceTimersByTimeAsync(0);expect((await pending).message).toContain('toBlob');expect(vi.getTimerCount()).toBe(0);
  });
  it('a silent encoder times out and cleans up',async()=>{
    canvas.toBlob.mockImplementation(()=>{});const pending=svgToPngBlob('<svg/>',600,450).catch(error=>error);await vi.advanceTimersByTimeAsync(120000);expect((await pending).message).toContain('timed out');expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it('failed download activation still removes the anchor and revokes its URL',async()=>{
    anchor.click.mockImplementation(()=>{throw new Error('download failure');});expect(()=>downloadBlob(new Blob(['svg']),'A-pbn.svg')).toThrow('download failure');expect(anchor.remove).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1000);expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
});
