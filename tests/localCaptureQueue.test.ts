import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueLocalCapture, readLocalCaptures, ackLocalCaptures, adoptLocalCaptures } from "../src/features/inbox/localCaptureQueue";
import type { RawCapture } from "../src/features/inbox/captureEngine";
let store: Record<string,string>;
const storage = { getItem: vi.fn((key:string)=>store[key]??null), setItem: vi.fn((key:string,value:string)=>{store[key]=value;}) };
const dispatchEvent = vi.fn();
vi.stubGlobal("localStorage",storage);
vi.stubGlobal("window",{dispatchEvent});
vi.stubGlobal("CustomEvent",class { constructor(public type:string,public options?:unknown){} });
const capture = (id:string,owner_id="owner-a"):RawCapture => ({schema_version:2,id,owner_id,source:"shortcut",captured_at:"2026-10-29T10:00:00Z",transaction_date:"2026-10-29T10:00:00Z",raw_text:"Payment Rp 1000"});
beforeEach(()=>{store={};vi.clearAllMocks();storage.getItem.mockImplementation(key=>store[key]??null);storage.setItem.mockImplementation((key,value)=>{store[key]=value;});});
describe("durable local capture queue",()=>{
 it("isolates owners and deduplicates retries without replacing captured text",()=>{
  enqueueLocalCapture(capture("one"));enqueueLocalCapture({...capture("one"),raw_text:"changed"});enqueueLocalCapture(capture("two","owner-b"));
  expect(readLocalCaptures("owner-a")).toEqual([capture("one")]);expect(readLocalCaptures("owner-b")).toEqual([capture("two","owner-b")]);
 });
 it("acks only completed IDs within their owner",()=>{
  enqueueLocalCapture(capture("one"));enqueueLocalCapture(capture("two"));enqueueLocalCapture(capture("one","owner-b"));
  ackLocalCaptures("owner-a",["one"]);
  expect(readLocalCaptures("owner-a")).toEqual([capture("two")]);expect(readLocalCaptures("owner-b")).toEqual([capture("one","owner-b")]);
 });
 it("does not overwrite an unreadable queue",()=>{
  store["accrual_local_captures:owner-a"]="broken";
  expect(()=>enqueueLocalCapture(capture("one"))).toThrow();expect(storage.setItem).not.toHaveBeenCalled();expect(store["accrual_local_captures:owner-a"]).toBe("broken");
 });
 it("propagates storage read failures without writing",()=>{
  storage.getItem.mockImplementation(()=>{throw Error("read failed");});
  expect(()=>enqueueLocalCapture(capture("one"))).toThrow("read failed");expect(storage.setItem).not.toHaveBeenCalled();
 });
 it("retries failed writes without premature success events",()=>{
  storage.setItem.mockImplementationOnce(()=>{throw Error("full");});
  expect(()=>enqueueLocalCapture(capture("one"))).toThrow("full");expect(dispatchEvent).not.toHaveBeenCalled();
  enqueueLocalCapture(capture("one"));expect(readLocalCaptures("owner-a")).toEqual([capture("one")]);expect(dispatchEvent).toHaveBeenCalledOnce();
 });
 it("keeps captures available if acknowledgement cannot persist",()=>{
  enqueueLocalCapture(capture("one"));storage.setItem.mockImplementationOnce(()=>{throw Error("full");});
  expect(()=>ackLocalCaptures("owner-a",["one"])).toThrow("full");expect(readLocalCaptures("owner-a")).toEqual([capture("one")]);
 });
 it("rejects captures without an owner",()=>{expect(()=>enqueueLocalCapture(capture("one",""))).toThrow();expect(storage.setItem).not.toHaveBeenCalled();});
 it.each(["{}","null",""])("rejects malformed persisted queues %s",raw=>{store["accrual_local_captures:owner-a"]=raw;expect(()=>readLocalCaptures("owner-a")).toThrow();});
});it("adopts guest raw captures only after explicit consent and supports retry",()=>{
 enqueueLocalCapture(capture("guest-one","guest:123"));
 adoptLocalCaptures("guest:123","owner-a");adoptLocalCaptures("guest:123","owner-a");
 expect(readLocalCaptures("guest:123")).toHaveLength(0);expect(readLocalCaptures("owner-a").map(item=>item.owner_id)).toEqual(["owner-a"]);
});
