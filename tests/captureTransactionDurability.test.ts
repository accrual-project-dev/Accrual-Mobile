import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const state = vi.hoisted(() => ({ qc: null as any }));
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-query')>(),
  useQueryClient: () => state.qc,
  useMutation: (options: any) => options,
}));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: (current: unknown) => ({ current }),
}));
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-a' } }) }));
vi.mock('../src/hooks/useGoals', () => ({ deductGoalFromStorage: vi.fn(), addGoalToStorage: vi.fn() }));
vi.mock('../src/lib/indexedDbStorage', () => ({ getVaultItem: vi.fn(), setVaultItem: vi.fn().mockResolvedValue(undefined), removeVaultItem: vi.fn() }));
vi.mock('../src/components/ui/SyncStatusPill', () => ({ emitSyncStatus: vi.fn() }));

import { useAddTransaction } from '../src/hooks/useTransactions';
import { supabase } from '../src/lib/supabase';
import { decideCapture } from '../src/features/inbox/captureEngine';

const captureId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const queryKey = ['transactions', 'all', 'owner-a'];
const input = () => ({ id: captureId, expectedUserId: 'owner-a', amount: 45000, type: 'expense', category_id: null, wallet_id: null, occurred_on: '2026-10-29T10:00:00', ledger_id: 'personal' });
let storage: Map<string, string>;

beforeEach(() => {
  state.qc = new QueryClient();
  state.qc.setQueryData(queryKey, []);
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: { user: { id: 'owner-a' } } }, error: null } as any);
});
afterEach(() => { state.qc.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('leaves a failed strict enqueue out of caches so its raw capture is not acknowledged as processed', async () => {
  storage.set('TROUVAILLE_PENDING_MUTATIONS_V2', '{broken');
  const options: any = useAddTransaction();
  const vars = input();
  const context = await options.onMutate(vars);
  await expect(options.mutationFn(vars)).rejects.toThrow();
  options.onError(new Error('enqueue failed'), vars, context);
  const transactions: any[] = state.qc.getQueryData(queryKey) || [];
  expect(transactions).toEqual([]);
  const decision = decideCapture({ schema_version: 2, id: captureId, owner_id: 'owner-a', source: 'notification', raw_text: 'Unclear payment', captured_at: '2026-10-29T10:00:00', transaction_date: '2026-10-29T10:00:00' }, { ownerId: 'owner-a', transactions, categories: [], wallets: [], ledgerIds: [], preferences: { ledgerId: null, rules: [] } });
  expect(decision.action).toBe('review');
});

it('publishes a durably queued capture when the network is unavailable', async () => {
  vi.spyOn(supabase, 'from').mockImplementation(() => { throw new Error('offline'); });
  const options: any = useAddTransaction();
  const vars = input();
  const context = await options.onMutate(vars);
  expect(state.qc.getQueryData(queryKey)).toEqual([]);
  const saved = await options.mutationFn(vars);
  expect(JSON.parse(storage.get('TROUVAILLE_PENDING_MUTATIONS_V2')!)[0].payload.id).toBe(captureId);
  await options.onSuccess(saved, vars, context);
  expect((state.qc.getQueryData(queryKey) as any[])[0].id).toBe(captureId);
});

it('does not publish or invalidate after the actual authenticated session changes', async () => {
  const options: any = useAddTransaction();
  const vars = input();
  const context = await options.onMutate(vars);
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'owner-b' } } }, error: null } as any);
  const invalidate = vi.spyOn(state.qc, 'invalidateQueries');
  await options.onSuccess({ ...context.optimisticItem, user_id: 'owner-a' }, vars, context);
  await options.onSettled(undefined, null, vars);
  expect(state.qc.getQueryData(queryKey)).toEqual([]);
  expect(invalidate).not.toHaveBeenCalled();
});

it('isolates retained captures in cloud offline recovery with an existing backup',async()=>{
 const {fetchAllTransactionsFromSupabase,TX_BACKUP_STORAGE_KEY}=await import('../src/hooks/useTransactions');
 storage.set(TX_BACKUP_STORAGE_KEY,JSON.stringify([{id:'b-backup',user_id:'owner-b',occurred_on:'2026-10-29T10:00:00',amount:1,type:'expense'}]));
 storage.set('TROUVAILLE_PENDING_MUTATIONS_V2',JSON.stringify([
  {id:'a',type:'insert',captureOwnerId:'owner-a',payload:{id:'a-capture',user_id:'owner-a',occurred_on:'2026-10-29T10:00:00'}},
  {id:'b',type:'insert',captureOwnerId:'owner-b',payload:{id:'b-capture',user_id:'owner-b',occurred_on:'2026-10-29T10:00:00'}}
 ]));
 vi.mocked(supabase.auth.getSession).mockResolvedValue({data:{session:{user:{id:'owner-b'}}},error:null} as any);
 vi.spyOn(supabase,'from').mockImplementation(()=>{throw new Error('offline');});
 const result=await fetchAllTransactionsFromSupabase({userId:'owner-b'});
 expect(result.map(tx=>tx.id).sort()).toEqual(['b-backup','b-capture']);
});

it('hides retained authenticated and prior-guest captures from a fresh guest session',async()=>{
 const {fetchAllTransactionsFromSupabase}=await import('../src/hooks/useTransactions');
 storage.set('ACCRUAL_CAPTURE_GUEST_OWNER','guest:current');
 storage.set('TROUVAILLE_PENDING_MUTATIONS_V2',JSON.stringify([
  {id:'auth',type:'insert',captureOwnerId:'owner-a',payload:{id:'auth',user_id:'owner-a'}},
  {id:'old',type:'insert',captureOwnerId:'guest:old',payload:{id:'old',user_id:'guest_local_user'}},
  {id:'current',type:'insert',captureOwnerId:'guest:current',payload:{id:'current',user_id:'guest_local_user',occurred_on:'2026-10-29T10:00:00'}}
 ]));
 const result=await fetchAllTransactionsFromSupabase({userId:'guest_local_user'});
 expect(result.map(tx=>tx.id)).toEqual(['current']);
});
