import { expect, it, vi, afterEach } from 'vitest';
import { getPendingMutations } from '../src/lib/syncEngine';
afterEach(() => vi.unstubAllGlobals());
it('does not replay known promo records retained by an old build', () => {
 const rows = [
  {id:'spam',type:'insert',payload:{note:'Kak masih bisa klaim 500rb sesama shopeepay'}},
  {id:'real',type:'insert',payload:{note:'Pembayaran berhasil Rp 500.000'}},
 ];
 vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(rows)});
 expect(getPendingMutations().map(item=>item.id)).toEqual(['real']);
});
