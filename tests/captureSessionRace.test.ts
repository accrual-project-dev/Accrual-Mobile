import {expect,it} from 'vitest';
import {assertCaptureSession} from '../src/features/inbox/captureOwner';
it('refuses to book when a capture session changed',()=>{
 expect(()=>assertCaptureSession('a','b')).toThrow();expect(()=>assertCaptureSession('a',undefined)).toThrow();expect(()=>assertCaptureSession('a','a')).not.toThrow();
});
