import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PipelineController,type WorkerPort} from './PipelineController';
import {useStore} from '../state/store';
let controller:PipelineController;
beforeEach(()=>useStore.setState(useStore.getInitialState(),true));
afterEach(()=>controller?.dispose());
function worker(){return {onmessage:null,onerror:null,onmessageerror:null,postMessage:vi.fn(),terminate:vi.fn()} as WorkerPort&{postMessage:ReturnType<typeof vi.fn>;terminate:ReturnType<typeof vi.fn>};}
it('starts one worker with the app before any file selection, without sending processing work',()=>{
 const port=worker(),factory=vi.fn(()=>port);controller=new PipelineController({workerFactory:factory});controller.start();controller.start();
 expect(factory).toHaveBeenCalledOnce();expect(port.postMessage).not.toHaveBeenCalled();expect(useStore.getState().status).toBe('empty');expect(useStore.getState().busy).toBe(false);expect(controller.diagnostics().pendingRequests).toBe(0);
});
it('disposal releases the preloaded worker even when the customer never chooses a file',()=>{
 const port=worker();controller=new PipelineController({workerFactory:()=>port});controller.start();controller.dispose();controller.dispose();
 expect(port.terminate).toHaveBeenCalledOnce();expect(port.onmessage).toBeNull();expect(port.onerror).toBeNull();expect(controller.diagnostics().pendingRequests).toBe(0);
});
it('an effect disposed before its deferred startup cannot create a worker',()=>{
 const factory=vi.fn(()=>worker());controller=new PipelineController({workerFactory:factory});controller.dispose();controller.start();
 expect(factory).not.toHaveBeenCalled();expect(controller.diagnostics().disposed).toBe(true);
});
