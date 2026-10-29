import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../src/hooks/useTransactions',()=>({TX_BACKUP_STORAGE_KEY:'tx',generateUUID:()=> 'generated'}));
vi.mock('../src/hooks/useWallets',()=>({WALLETS_BACKUP_STORAGE_KEY:'wallets'}));
vi.mock('../src/lib/marketPriceService',()=>({getSavedUsdtPref:()=>null,getSavedHoldings:()=>[],saveUsdtPref:vi.fn(),saveHoldings:vi.fn()}));
vi.mock('../src/lib/syncEngine',async original=>({...await original<typeof import('../src/lib/syncEngine')>(),flushPendingMutations:vi.fn().mockResolvedValue({})}));
import {migrateGuestDataToCloud,discardGuestData} from '../src/lib/guestMigration';
import {enqueuePendingMutation,getPendingMutations} from '../src/lib/syncEngine';
import {GUEST_CAPTURE_OWNER_KEY} from '../src/features/inbox/captureOwner';
afterEach(()=>vi.unstubAllGlobals());
function seed(){
 const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});
 data.set(GUEST_CAPTURE_OWNER_KEY,'guest:current');
 enqueuePendingMutation('insert',{id:'auth-a',user_id:'owner-a'},'owner-a');
 enqueuePendingMutation('insert',{id:'guest-current',user_id:'guest_local_user'},'guest:current');
 enqueuePendingMutation('insert',{id:'guest-old',user_id:'guest_local_user'},'guest:old');
 return data;
}
it('migrates only the explicitly selected guest capture owner',async()=>{
 seed();const result=await migrateGuestDataToCloud('owner-b');expect(result.transactionsMigrated).toBe(1);
 const pending=getPendingMutations();expect(pending).toHaveLength(3);
 expect(pending.find(m=>m.payload.id==='auth-a')?.captureOwnerId).toBe('owner-a');
 expect(pending.find(m=>m.payload.id==='auth-a')?.payload.user_id).toBe('owner-a');
 expect(pending.find(m=>m.payload.id==='guest-old')?.captureOwnerId).toBe('guest:old');
 expect(pending.find(m=>m.payload.id==='guest-current')?.captureOwnerId).toBe('owner-b');
 expect(pending.find(m=>m.payload.id==='guest-current')?.payload.user_id).toBe('owner-b');
});
it('declining guest migration preserves other owners pending captures',()=>{
 seed();discardGuestData('owner-b');expect(getPendingMutations().map(m=>m.payload.id)).toEqual(['auth-a','guest-old']);
});

it('permits a new explicitly selected guest capture after the account migrated an earlier guest',async()=>{
 const data=seed();data.set('trouvaille_migrated_guest_owner-b','true');
 const result=await migrateGuestDataToCloud('owner-b');expect(result.transactionsMigrated).toBe(1);
 expect(getPendingMutations().find(m=>m.payload.id==='guest-current')?.captureOwnerId).toBe('owner-b');
});

it('does not complete guest migration when durable owner reassignment fails',async()=>{
 const data=seed();const original=localStorage.setItem.bind(localStorage);
 vi.spyOn(localStorage,'setItem').mockImplementation((key,value)=>{if(key==='TROUVAILLE_PENDING_MUTATIONS_V2')throw new Error('storage full');original(key,value);});
 await expect(migrateGuestDataToCloud('owner-b')).rejects.toThrow('storage full');
 expect(data.get(GUEST_CAPTURE_OWNER_KEY)).toBe('guest:current');
 expect(data.get('trouvaille_migrated_guest_owner-b')).toBeUndefined();
 expect(getPendingMutations().find(m=>m.payload.id==='guest-current')?.captureOwnerId).toBe('guest:current');
 vi.restoreAllMocks();
});
