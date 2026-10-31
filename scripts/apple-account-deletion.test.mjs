import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.ts';

const encode = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const signingKey = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', signingKey.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`;
const appleKey = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', appleKey.publicKey), kid: 'apple-test' };
const config = { supabaseUrl: 'https://noticed.example', anonKey: 'test-anon', serviceRoleKey: 'test-server-key', appleClientId: 'com.syntheticae.accrual', appleTeamId: 'test-team', appleKeyId: 'test-key', applePrivateKey: privateKey };

async function appleToken(overrides = {}, corrupt = false) {
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: 'https://appleid.apple.com', aud: config.appleClientId, sub: 'apple-sub', iat: now, exp: now + 300, ...overrides })}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', appleKey.privateKey, Buffer.from(payload));
  if (corrupt) new Uint8Array(sig)[0] ^= 1;
  return `${payload}.${Buffer.from(sig).toString('base64url')}`;
}

async function fixture(options = {}) {
  const calls = [];
  const storageCalls = [];
  let filesRemoved = false;
  const user = { id: 'user-id', identities: options.nonApple ? [{ provider: 'email' }] : [{ provider: 'apple', identity_data: { sub: 'apple-sub' } }] };
  const idToken = await appleToken(options.claims, options.corrupt);
  const transport = async (url, init) => {
    if (!url.includes('/storage/v1/') && !url.endsWith('/rpc/list_account_media')) calls.push(new URL(url).pathname);
    if (url.endsWith('/rpc/list_account_media')) {
      storageCalls.push('list');
      assert.equal(init.headers.Authorization, 'Bearer user-session');
      return Response.json(options.storageFailure? {error:'unavailable'} : options.hasFile && !filesRemoved ? [{name:'photos/user-id/file.jpg'}] : [],{status:options.storageFailure?503:200});
    }
    if (url.endsWith('/storage/v1/object/noticed-media')) {
      storageCalls.push('remove');
      assert.equal(init.method,'DELETE');
      assert.equal(init.headers.Authorization,'Bearer user-session');
      assert.deepEqual(JSON.parse(init.body),{prefixes:['photos/user-id/file.jpg']});
      filesRemoved=!options.removeFailure;
      return Response.json(options.removeFailure?{error:'unavailable'}:[],{status:options.removeFailure?503:200});
    }
    if (url.endsWith('/auth/v1/user')) return Response.json(options.unauthorized ? {} : user, { status: options.unauthorized ? 401 : 200 });
    if (url.endsWith('/auth/token')) {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get('code'), 'single-use-code');
      assert.equal(form.get('client_id'), config.appleClientId);
      const secret = form.get('client_secret').split('.');
      assert.equal(JSON.parse(Buffer.from(secret[1], 'base64url')).sub, config.appleClientId);
      assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signingKey.publicKey, Buffer.from(secret[2], 'base64url'), Buffer.from(secret.slice(0, 2).join('.'))), true);
      return Response.json(options.exchangeFailure ? { error: 'invalid_grant', secret: 'never echo' } : { id_token: idToken, refresh_token: 'private-refresh-token' }, { status: options.exchangeFailure ? 400 : 200 });
    }
    if (url.endsWith('/auth/keys')) return Response.json({ keys: [jwk] });
    if (url.endsWith('/auth/revoke')) {
      assert.equal(new URLSearchParams(init.body).get('token'), 'private-refresh-token');
      return new Response('', { status: options.revokeFailure ? 503 : 200 });
    }
    if (url.endsWith('/rest/v1/rpc/delete_user_account')) {
      assert.equal(init.headers.Authorization, 'Bearer test-server-key');
      assert.deepEqual(JSON.parse(init.body), {p_user_id:'user-id'});
      return new Response(options.deleteFailure ? '{"secret":"never echo"}' : null, { status: options.deleteFailure ? 500 : 204 });
    }
    assert.fail(`Unexpected endpoint: ${url}`);
  };
  return { calls, storageCalls, handler: createDeleteAccountHandler(config, transport) };
}

const request = (body = { authorizationCode: 'single-use-code' }, authorized = true) => new Request('https://edge.example/delete-account', {
  method: 'POST', headers: { ...(authorized ? { Authorization: 'Bearer user-session' } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({expectedUserId:'user-id',...body}),
});

test('unauthenticated requests cannot reach deletion or Apple', async () => {
  const f = await fixture();
  assert.equal((await f.handler(request({}, false))).status, 401);
  assert.deepEqual(f.calls, []);
  const rejected = await fixture({ unauthorized: true });
  assert.equal((await rejected.handler(request())).status, 401);
  assert.deepEqual(rejected.calls, ['/auth/v1/user']);
});

test('non-Apple users delete only their own caller-scoped account', async () => {
  const f = await fixture({ nonApple: true });
  const response = await f.handler(request({ userId: 'someone-else' }));
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls, ['/auth/v1/user', '/rest/v1/rpc/delete_user_account']);
});

test('Apple deletion requires a fresh authorization code', async () => {
  const f = await fixture();
  assert.equal((await f.handler(request({}))).status, 400);
  assert.deepEqual(f.calls, ['/auth/v1/user']);
});

test('Apple authorization is verified and revoked before deleting account data', async () => {
  const f = await fixture();
  const r = await f.handler(request());
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { deleted: true, appleRevoked: true });
  assert.deepEqual(f.calls, ['/auth/v1/user', '/auth/token', '/auth/keys', '/auth/revoke', '/rest/v1/rpc/delete_user_account']);
});

test('wrong Apple account, expired token, wrong audience, or invalid signature never revoke or delete', async () => {
  for (const options of [{ claims: { sub: 'other-apple-user' } }, { claims: { exp: 1 } }, { claims: { aud: 'other.app' } }, { corrupt: true }]) {
    const f = await fixture(options);
    assert.equal((await f.handler(request())).status, 400);
    assert.equal(f.calls.includes('/auth/revoke'), false);
    assert.equal(f.calls.includes('/rest/v1/rpc/delete_user_account'), false);
  }
});

test('Apple exchange/revocation failure preserves account data and does not expose upstream secrets', async () => {
  for (const options of [{ exchangeFailure: true }, { revokeFailure: true }]) {
    const f = await fixture(options);
    const r = await f.handler(request());
    assert.equal(r.status, 502);
    assert.equal((await r.text()).includes('never echo'), false);
    assert.equal(f.calls.includes('/rest/v1/rpc/delete_user_account'), false);
  }
});

test('database failure is not reported as successful deletion', async () => {
  const f = await fixture({ nonApple: true, deleteFailure: true });
  const r = await f.handler(request({}));
  assert.equal(r.status, 502);
  assert.equal((await r.text()).includes('never echo'), false);
});
