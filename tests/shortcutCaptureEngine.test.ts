import { expect, it } from 'vitest';
import { decideCapture, type RawCapture } from '../src/features/inbox/captureEngine';
import type { Category, Wallet } from '../src/lib/types';
const capture = {schema_version:2,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',owner_id:'u1',source:'shortcut_notification',source_app:'BCA',captured_at:'2026-10-29T10:00:00+07:00',transaction_date:'2026-10-29T10:00:00+07:00',raw_text:'Pembayaran QRIS Rp 45.000 di Kopi Kenangan berhasil.'} as RawCapture;
const ctx = {ownerId:'u1',categories:[{id:'c1',name:'Food',type:'expense'}] as Category[],wallets:[{id:'w1',name:'BCA'}] as Wallet[],transactions:[],ledgerIds:['personal'],preferences:{ledgerId:'personal',rules:[{sourceApp:'BCA',walletId:'w1',categoryId:'c1'}]}};
it('saves only a successful transaction with explicit source mapping', () => { expect(decideCapture(capture, ctx).action).toBe('save'); });
it('reviews missing mapping, several monetary amounts and foreign currency', () => {
 expect(decideCapture(capture,{...ctx,preferences:{ledgerId:null,rules:[]}}).action).toBe('review');
 expect(decideCapture({...capture,raw_text:capture.raw_text+' Saldo Rp 100.000'},ctx).action).toBe('review');
 expect(decideCapture({...capture,raw_text:'Payment successful USD 12.50 at Cafe'},ctx).action).toBe('review');
});
it('never processes another owner or OTP/promo/failure as money', () => {
 expect(decideCapture({...capture,owner_id:'other'},ctx).action).toBe('hold');
 for(const raw_text of ['OTP 123456 Rp 50000','Promo cashback Rp 50000','Pembayaran Rp 50000 gagal']) expect(decideCapture({...capture,raw_text},ctx).action).toBe('ignore');
});
it('retains ambiguous unparsed captures for review', () => {expect(decideCapture({...capture,raw_text:'Unclear text'},ctx).action).toBe('review');});
it('does not book a known capture twice', () => {expect(decideCapture(capture,{...ctx,transactions:[{id:capture.id} as any]}).action).toBe('ignore');});
it('reviews a real payment mentioning promotion instead of silently dropping it',()=>{
 expect(decideCapture({...capture,raw_text:'Pembayaran QRIS Rp 45.000 berhasil, promo diterapkan.'},ctx).action).toBe('review');
});
it('does not infer the DANA app from the phrase dana masuk',()=>{
 expect(decideCapture({...capture,source_app:undefined,raw_text:'Dana masuk Rp 45.000 diterima'}, {...ctx,preferences:{ledgerId:'personal',rules:[{sourceApp:'DANA',walletId:'w1',categoryId:'c1'}]}}).action).toBe('review');
});
it('does not interpret a successful balance inquiry as an expense',()=>{
 expect(decideCapture({...capture,raw_text:'BCA\nPengecekan saldo berhasil. Saldo Rp 45.000'},ctx).action).toBe('review');
});
it('does not choose a direction when income and expense evidence conflict',()=>{
 expect(decideCapture({...capture,raw_text:'Pembayaran diterima Rp 45.000 berhasil.'},ctx).action).toBe('review');
});
it('preserves the receipt date rather than the later screenshot time',()=>{
 const result=decideCapture({...capture,source:'shortcut_screenshot',raw_text:'BCA\nPembayaran Rp 45.000 berhasil\n28/10/2026 10:30:00'},ctx);
 expect(result.action).toBe('save');if(result.action==='save')expect(result.transaction.occurred_on).toBe('2026-10-28T10:30:00');
});
it('reviews screenshots without a reliable occurrence timestamp',()=>{
 expect(decideCapture({...capture,source:'shortcut_screenshot'},ctx).action).toBe('review');
});
it('reviews successful creation of a request rather than booking money movement',()=>{
 expect(decideCapture({...capture,raw_text:'Permintaan pembayaran Rp 45.000 berhasil dikirim'},ctx).action).toBe('review');
});
