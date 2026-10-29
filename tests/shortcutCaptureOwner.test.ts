import { expect,it,vi,afterEach } from 'vitest';
import { getCaptureOwner } from '../src/features/inbox/captureOwner';
afterEach(()=>vi.unstubAllGlobals());
it('uses distinct persisted guest scope and stable authenticated owner',()=>{
 const store = new Map<string,string>(); vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)||null,setItem:(k:string,v:string)=>store.set(k,v)});
 expect(getCaptureOwner('u1')).toBe('u1');
 const guest = getCaptureOwner('guest_local_user'); expect(guest).toMatch(/^guest:/);expect(getCaptureOwner('guest_local_user')).toBe(guest);
 expect(getCaptureOwner(null)).toBeNull();
});
