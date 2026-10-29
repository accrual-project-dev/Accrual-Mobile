import type { RawCapture } from "./captureEngine";

function storageKey(ownerId: string): string {
  if (!ownerId) throw new Error("Capture owner is required");
  return `accrual_local_captures:${ownerId}`;
}

export function readLocalCaptures(ownerId: string): RawCapture[] {
  const raw = localStorage.getItem(storageKey(ownerId));
  const captures: RawCapture[] = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(captures) || captures.some(capture => !capture || !capture.id || capture.owner_id !== ownerId)) {
    throw new Error("Invalid local capture queue");
  }
  return captures;
}

export function enqueueLocalCapture(capture: RawCapture): void {
  const ownerId = capture.owner_id;
  if (!ownerId || !capture.id) throw new Error("Capture ID and owner are required");
  const captures = readLocalCaptures(ownerId);
  if (captures.some(item => item.id === capture.id)) return;
  localStorage.setItem(storageKey(ownerId), JSON.stringify([...captures, capture]));
  window.dispatchEvent(new CustomEvent("accrual:local-capture"));
}

export function ackLocalCaptures(ownerId: string, ids: string[]): void {
  const captures = readLocalCaptures(ownerId);
  const acknowledged = new Set(ids);
  localStorage.setItem(storageKey(ownerId), JSON.stringify(captures.filter(capture => !acknowledged.has(capture.id))));
}export function adoptLocalCaptures(fromOwnerId:string,toOwnerId:string):void {
 if(!fromOwnerId.startsWith('guest:') || !toOwnerId || toOwnerId.startsWith('guest:')) throw new Error('Explicit guest adoption required');
 const source=readLocalCaptures(fromOwnerId);const destination=readLocalCaptures(toOwnerId);
 const known=new Set(destination.map(item=>item.id));
 const merged=[...destination,...source.filter(item=>!known.has(item.id)).map(item=>({...item,owner_id:toOwnerId,allow_auto:false}))];
 localStorage.setItem(storageKey(toOwnerId),JSON.stringify(merged));
 ackLocalCaptures(fromOwnerId,source.map(item=>item.id));
}
