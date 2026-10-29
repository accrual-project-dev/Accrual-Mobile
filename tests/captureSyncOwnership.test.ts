import { expect, it, vi, afterEach } from 'vitest';
import { flushPendingMutations, enqueuePendingMutation } from '../src/lib/syncEngine';
import { supabase } from '../src/lib/supabase';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('does not rewrite another users queued insert to the current user',async()=>{
 const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});vi.stubGlobal('navigator',{onLine:true});
 enqueuePendingMutation('insert',{id:'capture',user_id:'owner-a',amount:100});
 vi.spyOn(supabase.auth,'getSession').mockResolvedValue({data:{session:{user:{id:'owner-b'}}},error:null} as any);
 const from=vi.spyOn(supabase,'from').mockImplementation(()=>{throw new Error('Unexpected network call');});
 const result=await flushPendingMutations({force:true});
 expect(from).not.toHaveBeenCalled();expect(result.flushedCount).toBe(0);expect(result.remainingCount).toBe(1);
});
