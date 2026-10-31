import { createDeleteAccountHandler } from './handler.ts';

Deno.serve(createDeleteAccountHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  appleClientId: 'com.syntheticae.accrual',
  appleTeamId: Deno.env.get('APPLE_TEAM_ID') ?? '',
  appleKeyId: Deno.env.get('APPLE_KEY_ID') ?? '',
  applePrivateKey: Deno.env.get('APPLE_PRIVATE_KEY') ?? '',
}));
