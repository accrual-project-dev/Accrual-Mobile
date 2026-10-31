import { beforeEach, describe, expect, it, vi } from 'vitest';
const { getUser, invoke, authorize } = vi.hoisted(() => ({ getUser: vi.fn(), invoke: vi.fn(), authorize: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { getUser }, functions: { invoke } } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }));
vi.mock('@capacitor-community/apple-sign-in', () => ({ SignInWithApple: { authorize } }));
import { deleteAccountOnServer } from '../src/lib/accountDeletion';
describe('server account deletion', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('does not delete when the verified account changed', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'other', identities: [] } }, error: null });
    await expect(deleteAccountOnServer('expected')).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
  it('requires fresh Apple approval and preserves the account on cancellation', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'expected', identities: [{ provider: 'apple' }] } }, error: null });
    authorize.mockRejectedValue(new Error('cancelled'));
    await expect(deleteAccountOnServer('expected')).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
  it('requires server confirmation and submits the expected identity and fresh code', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'expected', identities: [{ provider: 'apple' }] } }, error: null });
    authorize.mockResolvedValue({ response: { authorizationCode: 'one-use-code' } });
    invoke.mockResolvedValue({ data: { deleted: false }, error: null });
    await expect(deleteAccountOnServer('expected')).rejects.toThrow();
    expect(invoke).toHaveBeenCalledWith('delete-account', { body: { expectedUserId: 'expected', authorizationCode: 'one-use-code' } });
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    await expect(deleteAccountOnServer('expected')).resolves.toBeUndefined();
  });
});
