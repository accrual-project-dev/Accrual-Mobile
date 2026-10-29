import { useEffect, useRef, useCallback } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AccrualInbox } from '../../plugins/accrualInbox';
import { persistInboxDrafts } from './persistInboxDrafts';
import { decideCapture } from './captureEngine';
import { getCaptureOwner } from './captureOwner';
import { readLocalCaptures, ackLocalCaptures } from './localCaptureQueue';
import { getAllDraftItems } from '../../lib/draftTransactionService';
import { getCapturePreferences } from '../../lib/capturePreferences';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSecurityLock } from '../../contexts/SecurityLockContext';
import { useSpace } from '../../contexts/SpaceContext';
import { useWallets } from '../../hooks/useWallets';
import { useCategories } from '../../hooks/useCategories';
import { useAllTransactions, useAddTransaction } from '../../hooks/useTransactions';

export function useInboxDrain() {
 const busy = useRef(false);
 const {user} = useAuth(); const {isLocked} = useSecurityLock();
 const {spaces} = useSpace(); const {isIndonesian} = useLanguage(); const {showToast} = useToast();
 const {data:wallets=[],isSuccess:walletsReady}=useWallets();
 const {data:categories=[],isSuccess:categoriesReady}=useCategories();
 const {data:transactions=[],isSuccess:transactionsReady}=useAllTransactions();
 const {mutateAsync:addTransaction}=useAddTransaction();
 const current = useRef({userId:user?.id,locked:isLocked});current.current={userId:user?.id,locked:isLocked};
 const drain = useCallback(async()=>{
  if(busy.current || !user?.id || isLocked || !walletsReady || !categoriesReady || !transactionsReady || document.hidden) return;
  busy.current=true;
  try {
   const ownerId=getCaptureOwner(user.id); if(!ownerId) return;
   const nativeEnabled=Capacitor.isNativePlatform() && Capacitor.getPlatform()==="ios";
   if(nativeEnabled) await AccrualInbox.setOwner({ownerId});
   const nativeItems=nativeEnabled ? (await AccrualInbox.drain({ownerId})).items : [];
   const localItems=readLocalCaptures(ownerId);
   const localIds=new Set(localItems.map(item=>item.id));
   const items=[...nativeItems,...localItems];
   const receiptKey=`accrual_capture_receipts:${ownerId}`;
   const receipts:string[]=JSON.parse(localStorage.getItem(receiptKey)||"[]");
   if(!Array.isArray(receipts)) throw new Error("Invalid capture receipts");
   let saved=0,reviewed=0;
   const known=[...transactions];
   for(const item of items){
    if(current.current.userId!==user.id || current.current.locked) break;
    const acknowledge=async(ids:string[])=>{
     if(localIds.has(item.id)){ackLocalCaptures(ownerId,ids);return;}
     const receipt=await AccrualInbox.ack({ids,ownerId});if(!receipt.success || receipt.acknowledged!==ids.length) throw new Error("Capture acknowledgement incomplete");
    };
    if(receipts.includes(item.id)){await acknowledge([item.id]);continue;}
    const result=decideCapture(item,{ownerId,categories,wallets,transactions:known,ledgerIds:spaces.filter(s=>s.role!=="viewer").map(s=>s.id),preferences:getCapturePreferences(user.id),drafts:getAllDraftItems()});
    const ack=async(_ids:string[])=>{
     if(current.current.userId!==user.id) throw new Error("Capture session changed");
     if(!receipts.includes(item.id)) receipts.push(item.id);
     localStorage.setItem(receiptKey,JSON.stringify(receipts));
     await acknowledge([item.id]);
    };
    if(result.action==='hold') continue;
    if(result.action==='review'){
     const persisted=await persistInboxDrafts(result.items || [result.item],isIndonesian?'Tangkapan perlu ditinjau':'Captures to review',ack);
     if(persisted) reviewed++;
    } else if(result.action==='save'){
     const tx=await addTransaction({...result.transaction,expectedUserId:user.id});
     known.push(tx); // Also catches another same-value capture in this drain.
     await ack([item.id]);saved++;
     window.dispatchEvent(new CustomEvent("accrual:capture-saved",{detail:{transaction:tx,categoryName:categories.find(c=>c.id===tx.category_id)?.name,walletName:wallets.find(w=>w.id===tx.wallet_id)?.name}}));
    } else await ack([item.id]);
   }
   if(saved||reviewed) showToast(isIndonesian?`${saved} tersimpan di perangkat, ${reviewed} perlu ditinjau`:`${saved} saved on device, ${reviewed} need review`,'info');
  }catch(error){console.error('[CaptureInbox]',error);showToast(isIndonesian?'Tangkapan tetap dalam antrean. Coba lagi setelah membuka aplikasi.':'Captures remain queued. Retry after opening the app.','info');}
  finally{busy.current=false;if(current.current.userId===user?.id && !current.current.locked) window.dispatchEvent(new CustomEvent("accrual:inbox-drained",{detail:{userId:user?.id}}));}
 },[user?.id,isLocked,walletsReady,categoriesReady,transactionsReady,wallets,categories,transactions,spaces,isIndonesian,showToast,addTransaction]);
 const drainRef=useRef(drain);drainRef.current=drain;
 useEffect(()=>{void drainRef.current();},[user?.id,isLocked,walletsReady,categoriesReady,transactionsReady]);
 useEffect(()=>{

  let removed=false;let handle:{remove:()=>Promise<void>}|undefined;
  if(Capacitor.isNativePlatform()) void App.addListener('appStateChange',({isActive})=>{if(isActive) setTimeout(()=>void drainRef.current(),0);}).then(h=>{if(removed)void h.remove();else handle=h;});
  const refresh=()=>void drainRef.current();window.addEventListener('accrual:capture-settings',refresh);window.addEventListener('accrual:local-capture',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{removed=true;void handle?.remove();window.removeEventListener('accrual:capture-settings',refresh);window.removeEventListener('accrual:local-capture',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 useEffect(()=>{
  if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='ios')return;
  try{void AccrualInbox.setOwner({ownerId:getCaptureOwner(user?.id)}).catch(console.error);}catch(error){console.error(error);}
 },[user?.id]);
}
