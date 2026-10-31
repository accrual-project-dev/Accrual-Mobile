interface DeleteAccountConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  appleClientId: string;
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
}

class DeletionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const bytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const base64url = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const encoded = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

async function clientSecret(config: DeleteAccountConfig): Promise<string> {
  if (!config.applePrivateKey || !config.appleKeyId || !config.appleTeamId) {
    throw new DeletionError(503, 'Layanan penghapusan akun Apple belum tersedia. Silakan coba lagi.');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encoded({ alg: 'ES256', kid: config.appleKeyId })}.${encoded({ iss: config.appleTeamId, iat: now, exp: now + 600, aud: 'https://appleid.apple.com', sub: config.appleClientId })}`;
  const pem = config.applePrivateKey.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', bytes(pem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

async function verifyAppleIdentity(token: string, subjects: string[], clientId: string, request: typeof fetch): Promise<void> {
  const invalid = () => new DeletionError(400, 'Verifikasi akun Apple tidak cocok atau kedaluwarsa. Gunakan Apple ID yang terhubung ke akun ini.');
  let header, claims, parts;
  try {
    parts = token.split('.');
    if (parts.length !== 3) throw invalid();
    header = JSON.parse(new TextDecoder().decode(bytes(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(bytes(parts[1])));
  } catch { throw invalid(); }
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || claims.iss !== 'https://appleid.apple.com' ||
      claims.aud !== clientId || !subjects.includes(claims.sub) ||
      !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60) throw invalid();

  const response = await request('https://appleid.apple.com/auth/keys', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new DeletionError(502, 'Verifikasi Apple belum tersedia. Silakan coba lagi.');
  const keys = await response.json();
  const jwk = keys.keys?.find((key: JsonWebKey & { kid?: string }) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw invalid();
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(parts.slice(0, 2).join('.')));
    if (!valid) throw invalid();
  } catch { throw invalid(); }
}

// All authority comes from the verified caller session. No request-supplied user ID is used.
export function createDeleteAccountHandler(config: DeleteAccountConfig, request: typeof fetch = fetch) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return reply({ error: 'Metode tidak didukung.' }, 405);
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16384) return reply({ error: 'Silakan masuk kembali.' }, 401);
    try {
      const authHeaders = { apikey: config.anonKey, Authorization: authorization, 'Content-Type': 'application/json' };
      const auth = await request(`${config.supabaseUrl}/auth/v1/user`, { headers: authHeaders, signal: AbortSignal.timeout(10000) });
      if (!auth.ok) throw new DeletionError(auth.status === 401 || auth.status === 403 ? 401 : 502, 'Sesi akun tidak dapat diverifikasi. Silakan masuk kembali.');
      const user = await auth.json();
      if (!user.id || user.is_anonymous) throw new DeletionError(401, 'Silakan masuk ke akun yang akan dihapus.');
      const raw = await req.text();
      if (raw.length > 4096) throw new DeletionError(400, 'Permintaan terlalu besar.');
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { throw new DeletionError(400, 'Permintaan tidak valid.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DeletionError(400, 'Permintaan tidak valid.');
      if (body.expectedUserId !== user.id) throw new DeletionError(409, 'Sesi akun berubah. Penghapusan dibatalkan.');
      if (!config.serviceRoleKey) throw new DeletionError(503, 'Layanan penghapusan akun belum dikonfigurasi.');
      const identities = user.identities?.filter((identity: { provider: string }) => identity.provider === 'apple') ?? [];
      let appleRevoked = false;
      if (identities.length > 0) {
        const code = body.authorizationCode;
        if (typeof code !== 'string' || !code.trim() || code.length > 2048) throw new DeletionError(400, 'Verifikasi Apple diperlukan sebelum menghapus akun ini.');
        const subjects = identities.map((identity: { identity_data?: { sub?: string } }) => identity.identity_data?.sub).filter((subject: unknown): subject is string => typeof subject === 'string' && subject.length > 0);
        if (subjects.length === 0) throw new DeletionError(400, 'Identitas Apple akun ini belum dapat diverifikasi. Silakan masuk kembali.');
        const secret = await clientSecret(config);
        const token = await request('https://appleid.apple.com/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.appleClientId, client_secret: secret, code, grant_type: 'authorization_code' }), signal: AbortSignal.timeout(10000) });
        if (!token.ok) throw new DeletionError(502, 'Kode verifikasi Apple belum dapat diproses. Silakan coba lagi.');
        const tokens = await token.json();
        if (typeof tokens.id_token !== 'string' || typeof tokens.refresh_token !== 'string' || !tokens.refresh_token) throw new DeletionError(502, 'Apple belum memberikan token pencabutan akses. Silakan coba lagi.');
        await verifyAppleIdentity(tokens.id_token, subjects, config.appleClientId, request);
        const revoked = await request('https://appleid.apple.com/auth/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.appleClientId, client_secret: secret, token: tokens.refresh_token, token_type_hint: 'refresh_token' }), signal: AbortSignal.timeout(10000) });
        if (!revoked.ok) throw new DeletionError(502, 'Akses Apple belum dapat dicabut. Data akun belum dihapus; silakan coba lagi.');
        appleRevoked = true;
      }
      const deleted = await request(`${config.supabaseUrl}/rest/v1/rpc/delete_user_account`, { method: 'POST', headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user_id: user.id }), signal: AbortSignal.timeout(10000) });
      if (!deleted.ok) throw new DeletionError(502, 'Penghapusan data akun belum dapat dipastikan. Silakan masuk kembali dan coba lagi.');
      return reply({ deleted: true, appleRevoked });
    } catch (error) {
      // Never forward Apple/Supabase response bodies, tokens, private keys, or raw exceptions.
      return error instanceof DeletionError ? reply({ error: error.message }, error.status) : reply({ error: 'Layanan penghapusan akun belum dapat dihubungi. Silakan coba lagi.' }, 502);
    }
  };
}
