import { registerPlugin } from '@capacitor/core';
import type { RawCapture } from '../features/inbox/captureEngine';
export type InboxDraft = RawCapture;
export interface AccrualInboxPlugin {
 discardGuestOwner(options:{ownerId:string}):Promise<{success:boolean;discarded:number}>;
 setOwner(options:{ownerId:string|null}):Promise<{success:boolean}>;
 adoptOwner(options:{fromOwnerId:string;toOwnerId:string}):Promise<{success:boolean}>;
 drain(options:{ownerId:string}):Promise<{items:InboxDraft[]}>;
 ack(options:{ids:string[];ownerId:string}):Promise<{success:boolean;acknowledged:number;ids:string[]}>;
}
export const AccrualInbox = registerPlugin<AccrualInboxPlugin>('AccrualInbox');
