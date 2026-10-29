import type { Category, Wallet, Transaction } from '../../lib/types';
import type { CapturePreferences } from '../../lib/capturePreferences';
import type { ParsedStatementItem } from '../../lib/statementParser';
import type { TransactionInput } from '../../hooks/useTransactions';
import { parseDeepLink, parseIndonesianDate } from '../../lib/deepLinkHandler';
import { inboxDateParts } from './inboxDateParts';
export interface RawCapture {schema_version:number;id:string;owner_id?:string;source:string;source_app?:string;allow_auto?:boolean;title?:string;subtitle?:string;captured_at:string;transaction_date:string;raw_text:string;amount?:number;currency?:string;direction?:string;confidence?:number;wallet_hint?:string;merchant?:string|null}
export interface CaptureContext {ownerId:string;categories:Category[];wallets:Wallet[];transactions:Transaction[];ledgerIds:string[];preferences:CapturePreferences;drafts?:ParsedStatementItem[]}
export type CaptureDecision = {action:'hold'|'ignore';reason:string}|{action:'review';reason:string;item:ParsedStatementItem;items?:ParsedStatementItem[]}|{action:'save';reason:string;item:ParsedStatementItem;transaction:TransactionInput & {id:string}};
export function decideCapture(capture:RawCapture,ctx:CaptureContext): CaptureDecision {
 if (!capture.owner_id || capture.owner_id !== ctx.ownerId) return {action:'hold',reason:'owner'};
 if (ctx.transactions.some(tx=>tx.id===capture.id)) return {action:'ignore',reason:'processed'};
 const text = [capture.title,capture.subtitle,capture.raw_text].filter(Boolean).join('\n');
 const promotional=/\b(?:promo|voucher|diskon|kupon|cashback|reward|bonus)\b/i.test(text);
 if (/\b(?:otp|verification code|kode verifikasi)\b|gagal|failed|tidak berhasil|unsuccessful|declined|ditolak|dibatalkan|cancelled/i.test(text) || (promotional && !/berhasil|sukses|successful|completed|received|diterima/i.test(text))) return {action:'ignore',reason:'not_transaction'};
 const result = parseDeepLink(`accrual://add?text=${encodeURIComponent(text)}`,ctx.categories,ctx.wallets,ctx.transactions);
 const prefill = result.prefilledValues;
 const dateToken=text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/)?.[1];
 const timeToken=text.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/)?.[0];
 const receiptDate=dateToken && timeToken ? parseIndonesianDate(dateToken+' '+timeToken) : undefined;
 const numbers=dateToken?.split(/[\/-]/).map(Number);
 const validReceiptDate=!!receiptDate && !!numbers && (numbers[0]>999 ? receiptDate.getFullYear()===numbers[0] && receiptDate.getMonth()+1===numbers[1] && receiptDate.getDate()===numbers[2] : receiptDate.getFullYear()===numbers[2] && receiptDate.getMonth()+1===numbers[1] && receiptDate.getDate()===numbers[0]);
 const date = validReceiptDate ? receiptDate! : new Date(capture.transaction_date || capture.captured_at);
 const parts = inboxDateParts(date);
 const amount = prefill?.amount || capture.amount || 0;
 const type = prefill?.type === 'income' ? 'income' : prefill?.type === 'transfer' ? 'transfer' : 'expense';
 const expenseEvidence=/pembayaran|pembelian|debit|debet|dibayar|membayar|berhasil bayar|paid|payment|spent|purchase/i.test(text);
 const incomeEvidence=/dana masuk|uang masuk|diterima|menerima|received|income|pemasukan/i.test(text);
 const normal = (s:string) => s.trim().toLowerCase();
 const rules = ctx.preferences.rules.filter(rule => rule.sourceApp.trim() && (capture.source_app ? normal(rule.sourceApp)===normal(capture.source_app) : text.split(/\r?\n/).some(line=>normal(line)===normal(rule.sourceApp))));
 const rule = rules.length===1 ? rules[0] : undefined;
 const wallet = ctx.wallets.find(w=>w.id===rule?.walletId);
 const category = ctx.categories.find(c=>c.id===rule?.categoryId && c.type===type);
 const item: ParsedStatementItem = {id:capture.id,date:parts.date,time:parts.time,description:prefill?.note || capture.merchant || text.slice(0,100),cleanDescription:prefill?.note || capture.merchant || text.slice(0,100),amount,type,walletId:wallet?.id || null,walletName:wallet?.name,suggestedCategoryId:category?.id || null,suggestedCategoryName:category?.name || null,suggestedCategoryEmoji:null,destinationWalletId:prefill?.to_wallet_id || null,isDuplicate:false,selected:false,raw:text,confidence:0,needsReview:true};
 let reason = '';
 const monetary = [...text.matchAll(/(?:Rp\.?|IDR|USD|US\$|\$|EUR|SGD|JPY|GBP)\s*[\d.,]+/gi)];
 if (capture.schema_version!==2 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(capture.id)) reason='legacy';
 else if ((capture.source==='shortcut_screenshot' || dateToken) && !validReceiptDate) reason='timestamp';
 else if (result.action==='batch_review') reason='multiple_transactions';
 else if (!Number.isFinite(amount)||amount<=0||Number.isNaN(date.getTime())) reason='unparsed';
 else if (/USD|US\$|\$|EUR|SGD|JPY|GBP/i.test(text)) reason='currency';
 else if (monetary.length!==1) reason='multiple_amounts';
 else if (!/berhasil|sukses|successful|completed|received|diterima|dana masuk/i.test(text) || /pending|tertunda|menunggu/i.test(text)) reason='unconfirmed';
 else if (/permintaan|payment request|request payment|invoice|tautan pembayaran|payment link|dijadwalkan|scheduled/i.test(text)) reason='unconfirmed';
 else if (promotional || expenseEvidence===incomeEvidence || (type==='income' && !incomeEvidence) || (type==='expense' && !expenseEvidence)) reason='unconfirmed';
 else if (/transfer|top[ -]?up|isi saldo/i.test(text)) reason='transfer';
 else if (!wallet || !category || !ctx.preferences.ledgerId || !ctx.ledgerIds.includes(ctx.preferences.ledgerId)) reason='mapping';
 const duplicate = ctx.transactions.some(tx=>tx.amount===amount && tx.wallet_id===wallet?.id && Math.abs(new Date(tx.occurred_on).getTime()-date.getTime())<=48*60*60*1000);
 if (duplicate || ctx.drafts?.some(draft=>draft.id!==capture.id && draft.amount===amount && Math.abs(new Date(draft.date+"T"+(draft.time || "00:00")+":00").getTime()-date.getTime())<=48*60*60*1000)) {reason='possible_duplicate';item.isDuplicate=true;}
 if (capture.allow_auto === false && !reason) reason='unconfirmed';
 if (/USD|US\$|\$|EUR|SGD|JPY|GBP/i.test(text)) {reason='currency';item.amount=0;}
 if (reason) {
  item.captureReason=reason; item.captureLedgerId=ctx.preferences.ledgerId; item.captureOwnerId=ctx.ownerId; item.captureTimestampConfirmed=validReceiptDate || (capture.source!=="shortcut_screenshot" && !dateToken);
  const items=result.batchItems?.map((entry,index)=>({...entry,id:capture.id+":"+index,selected:false,needsReview:true,captureTimestampConfirmed:false,captureReason:reason,captureOwnerId:ctx.ownerId,captureLedgerId:ctx.preferences.ledgerId,walletId:null,destinationWalletId:null,suggestedCategoryId:null}));
  return {action:'review',reason,item,items};
 }
 item.selected=true;item.needsReview=false;item.confidence=1;
 return {action:'save',reason:'verified',item,transaction:{id:capture.id,amount,type,wallet_id:wallet!.id,category_id:category!.id,to_wallet_id:null,note:prefill?.note || undefined,occurred_on:parts.date+"T"+parts.time+":"+String(date.getSeconds()).padStart(2,"0"),ledger_id:ctx.preferences.ledgerId!,space_id:ctx.preferences.ledgerId!}};
}
