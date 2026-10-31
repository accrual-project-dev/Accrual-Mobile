import { Capacitor } from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from './supabase';

export async function deleteAccountOnServer(expectedUserId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !expectedUserId || data.user?.id !== expectedUserId) {
    throw new Error('Account identity changed. Sign in again before deleting.');
  }
  let authorizationCode: string | undefined;
  if (data.user.identities?.some(identity => identity.provider === 'apple')) {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      throw new Error('Apple account deletion requires the iOS app.');
    }
    const apple = await SignInWithApple.authorize({
      clientId: 'com.syntheticae.accrual',
      redirectURI: 'https://iqjcmqkgrfmopznrfikx.supabase.co/auth/v1/callback',
      scopes: 'email name',
    });
    authorizationCode = apple.response?.authorizationCode;
    if (!authorizationCode) throw new Error('Apple authorization was not completed.');
  }
  const result = await supabase.functions.invoke('delete-account', {
    body: { expectedUserId, authorizationCode },
  });
  if (result.error || result.data?.deleted !== true) {
    throw new Error('Account deletion was not confirmed by the server.');
  }
}
