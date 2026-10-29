import { generateUUID } from '../../lib/utils';
export const GUEST_CAPTURE_OWNER_KEY = 'ACCRUAL_CAPTURE_GUEST_OWNER';
export function getCaptureOwner(userId:string|null|undefined):string|null {
 if (!userId) return null;
 if (userId !== 'guest_local_user') return userId;
 const saved = localStorage.getItem(GUEST_CAPTURE_OWNER_KEY);
 if(saved?.startsWith('guest:')) return saved;
 const token = `guest:${generateUUID()}`; localStorage.setItem(GUEST_CAPTURE_OWNER_KEY,token); return token;
}
export function assertCaptureSession(expected:string|undefined,actual:string|undefined):void { if(expected && expected!==actual) throw new Error("Capture session changed before booking"); }
