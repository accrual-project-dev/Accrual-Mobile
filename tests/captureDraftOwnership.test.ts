import {afterEach,it,expect,vi} from 'vitest';
import {setCaptureDraftOwner,getAllDraftItems,saveDraftBatch,adoptCaptureDrafts,discardCaptureDrafts} from '../src/lib/draftTransactionService';
import type {ParsedStatementItem} from '../src/lib/statementParser';
afterEach(()=>{setCaptureDraftOwner(null);vi.unstubAllGlobals();});
it('hides other capture owners and only adopts or discards explicit guest scope',()=>{
 let value:string|null=null;vi.stubGlobal('window',{dispatchEvent:()=>true});vi.stubGlobal('CustomEvent',class{});vi.stubGlobal('localStorage',{getItem:()=>value,setItem:(_k:string,v:string)=>{value=v;}});
 saveDraftBatch([{id:'a',captureOwnerId:'guest:1'} as ParsedStatementItem,{id:'b',captureOwnerId:'other'} as ParsedStatementItem]);
 setCaptureDraftOwner('user');expect(getAllDraftItems()).toHaveLength(0);
 adoptCaptureDrafts('guest:1','user');expect(getAllDraftItems().map(i=>i.id)).toEqual(['a']);
 discardCaptureDrafts('user');setCaptureDraftOwner('other');expect(getAllDraftItems().map(i=>i.id)).toEqual(['b']);
});
