/* fara Trezor – backend za Cloudflare Workers (besplatno, bez servera koji moraš održavati).
   Čuva SAMO šifrovani trezor. Glavna šifra i ključ za šifrovanje nikad ne napuštaju uređaj.
   Postavljanje: pogledaj README.md  (treba KV namespace povezan kao "KV").
   Opcione varijable: ALLOW_ORIGIN (npr. https://tvojeime.github.io), INVITE_CODE, REGISTRATION=closed */
const enc = new TextEncoder();
const hexOf = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rnd = n => hexOf(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async s => hexOf(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const eq = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const norm = u => String(u || '').trim().toLowerCase();
const okAuth = a => typeof a === 'string' && /^[0-9a-f]{64}$/.test(a);
const okBlob = b => b && typeof b.iv === 'string' && typeof b.data === 'string' && b.data.length < 24e6;
const J = async (env, k) => { const v = await env.KV.get(k); return v ? JSON.parse(v) : null; };
const P = (env, k, v, opt) => env.KV.put(k, JSON.stringify(v), opt);

async function hmac(keyStr, msg, algo = 'SHA-256', raw = false) {
  const k = await crypto.subtle.importKey('raw', raw ? keyStr : enc.encode(keyStr), { name: 'HMAC', hash: algo }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
}
async function secretOf(env) { let s = await env.KV.get('meta:secret'); if (!s) { s = rnd(32); await env.KV.put('meta:secret', s); } return s; }
const fakeSalt = async (env, u) => btoa(String.fromCharCode(...(await hmac(await secretOf(env), enc.encode('salt:' + u))).subarray(0, 16)));
const hashAuth = (auth, ss) => sha256(ss + ':' + auth);

/* ---- TOTP (RFC 6238) ---- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = buf => { let bits = '', o = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) o += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return o; };
const b32dec = s => { let bits = ''; for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return new Uint8Array(o); };
async function totpAt(sec, step) {
  const b = new Uint8Array(8); new DataView(b.buffer).setUint32(4, step);
  const h = await hmac(b32dec(sec), b, 'SHA-1', true), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
async function totpCheck(u, code) {
  const now = Math.floor(Date.now() / 30000); code = String(code || '').replace(/\s/g, '');
  for (const d of [-1, 0, 1]) { const st = now + d; if (eq(await totpAt(u.totp, st), code) && st > (u.lastStep || 0)) { u.lastStep = st; return true; } }
  return false;
}

/* ---- ograničenje broja zahtjeva (u memoriji, okvirno) ---- */
const hits = new Map();
const limited = (k, max, win) => { const n = Date.now(), a = (hits.get(k) || []).filter(t => n - t < win); a.push(n); hits.set(k, a); if (hits.size > 5000) hits.clear(); return a.length > max; };

/* ---- sesije ---- */
async function mkToken(env, uid, req) {
  const t = rnd(32), h = await sha256(t), now = Date.now();
  await P(env, 't:' + h, { uid, created: now, last: now }, { expirationTtl: 30 * 86400 });
  const s = (await J(env, 's:' + uid)) || {};
  s[h] = { created: now, last: now, ua: String(req.headers.get('user-agent') || '').slice(0, 140), ip: req.headers.get('cf-connecting-ip') || '' };
  const ks = Object.keys(s).sort((a, b) => s[a].last - s[b].last);
  while (ks.length > 20) { const k = ks.shift(); delete s[k]; await env.KV.delete('t:' + k); }
  await P(env, 's:' + uid, s);
  return t;
}
async function authed(env, req) {
  const h = req.headers.get('authorization') || ''; if (!h.startsWith('Bearer ')) return null;
  const tk = await sha256(h.slice(7)), t = await J(env, 't:' + tk); if (!t) return null;
  const u = await J(env, 'u:' + t.uid); if (!u) return null;
  if (Date.now() - t.last > 3600e3) { // osvježi najviše jednom na sat (štedi KV upise)
    t.last = Date.now(); await P(env, 't:' + tk, t, { expirationTtl: 30 * 86400 });
    const s = (await J(env, 's:' + t.uid)) || {}; if (s[tk]) { s[tk].last = t.last; await P(env, 's:' + t.uid, s); }
  }
  return { u, uid: t.uid, tk };
}
async function revokeAll(env, uid, keep) {
  const s = (await J(env, 's:' + uid)) || {};
  for (const k of Object.keys(s)) if (k !== keep) { await env.KV.delete('t:' + k); delete s[k]; }
  await P(env, 's:' + uid, s);
}
async function checkPw(env, uid, u, auth) {
  if (Date.now() < (u.lockUntil || 0)) return 'locked';
  if (eq(await hashAuth(auth, u.ssalt), u.hash)) { if (u.fails) { u.fails = 0; await P(env, 'u:' + uid, u); } return 'ok'; }
  u.fails = (u.fails || 0) + 1; if (u.fails >= 5) u.lockUntil = Date.now() + Math.min(60, 2 ** (u.fails - 5)) * 60e3;
  await P(env, 'u:' + uid, u); return 'bad';
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('origin') || '', allow = env.ALLOW_ORIGIN || '*';
    const cors = { 'Vary': 'Origin' };
    if (allow === '*' || origin === allow) { cors['Access-Control-Allow-Origin'] = allow === '*' ? '*' : origin; cors['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'; cors['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'; cors['Access-Control-Max-Age'] = '86400'; }
    const send = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.KV) return send(500, { error: 'KV nije povezan s ovim Workerom (varijabla mora biti nazvana KV).' });
    const p = url.pathname, m = req.method, ip = req.headers.get('cf-connecting-ip') || 'x';
    if (p === '/' ) return new Response('fara Trezor API', { headers: cors });
    if (!p.startsWith('/api/')) return send(404, { error: 'Nepoznata putanja.' });
    try {
      if (limited('ip:' + ip, p === '/api/vault' ? 120 : 40, 60e3)) return send(429, { error: 'Previše zahtjeva. Pokušaj za minutu.' });
      if (m === 'GET' && p === '/api/health') return send(200, { ok: true, register: env.REGISTRATION !== 'closed', invite: !!env.INVITE_CODE });
      if (m === 'GET' && p === '/api/prelogin') { const u = norm(url.searchParams.get('u')), x = await J(env, 'u:' + await sha256(u)); return send(200, { salt: x ? x.salt : await fakeSalt(env, u) }); }
      let b = {};
      if (['POST', 'PUT', 'DELETE'].includes(m)) {
        if ((+req.headers.get('content-length') || 0) > 26e6) return send(413, { error: 'Trezor je prevelik.' });
        try { b = await req.json(); } catch { b = {}; }
      }

      if (m === 'POST' && p === '/api/register') {
        if (env.REGISTRATION === 'closed') return send(403, { error: 'Registracija je zatvorena na ovom serveru.' });
        if (env.INVITE_CODE && !eq(b.invite || '', env.INVITE_CODE)) return send(403, { error: 'Neispravan kod pozivnice.' });
        const u = norm(b.u), uid = await sha256(u);
        if (u.length < 3 || u.length > 254 || !okAuth(b.auth) || typeof b.salt !== 'string' || b.salt.length > 40 || !okBlob(b.blob)) return send(400, { error: 'Neispravni podaci.' });
        if (await env.KV.get('u:' + uid)) return send(409, { error: 'Račun s tim imenom već postoji.' });
        const ss = rnd(16);
        await P(env, 'u:' + uid, { u, salt: b.salt, ssalt: ss, hash: await hashAuth(b.auth, ss), created: Date.now(), lastLogin: Date.now(), fails: 0 });
        await P(env, 'v:' + uid, { blob: b.blob, version: 1 });
        return send(200, { token: await mkToken(env, uid, req), version: 1 });
      }
      if (m === 'POST' && p === '/api/login') {
        const u = norm(b.u), uid = await sha256(u);
        if (limited('login:' + u, 10, 15 * 60e3)) return send(429, { error: 'Previše pokušaja prijave. Pokušaj kasnije.' });
        if (!okAuth(b.auth)) return send(400, { error: 'Neispravni podaci.' });
        const x = await J(env, 'u:' + uid);
        if (!x) return send(401, { error: 'Pogrešno ime ili šifra.' });
        const r = await checkPw(env, uid, x, b.auth);
        if (r === 'locked') return send(429, { error: 'Račun je privremeno zaključan zbog pogrešnih pokušaja.' });
        if (r === 'bad') return send(401, { error: 'Pogrešno ime ili šifra.' });
        if (x.totp) {
          if (!b.totp && !b.recovery) return send(200, { need2fa: true });
          let good = false;
          if (b.totp) good = await totpCheck(x, b.totp);
          else { const h = await sha256(String(b.recovery).trim().toLowerCase()), i = (x.recovery || []).indexOf(h); if (i >= 0) { x.recovery.splice(i, 1); good = true; } }
          if (!good) { x.fails = (x.fails || 0) + 1; await P(env, 'u:' + uid, x); return send(401, { error: 'Neispravan kod.' }); }
        }
        const prev = x.lastLogin; x.lastLogin = Date.now(); await P(env, 'u:' + uid, x);
        const v = await J(env, 'v:' + uid);
        return send(200, { token: await mkToken(env, uid, req), salt: x.salt, blob: v.blob, version: v.version, has2fa: !!x.totp, last: prev, recoveryLeft: (x.recovery || []).length });
      }

      const a = await authed(env, req); if (!a) return send(401, { error: 'Sesija je istekla. Prijavi se ponovo.' });
      const { u, uid } = a;
      if (m === 'GET' && p === '/api/vault') return send(200, await J(env, 'v:' + uid));
      if (m === 'PUT' && p === '/api/vault') {
        if (!okBlob(b.blob)) return send(400, { error: 'Neispravan trezor.' });
        const v = await J(env, 'v:' + uid);
        if (b.base !== v.version) return send(409, v);
        v.blob = b.blob; v.version++; await P(env, 'v:' + uid, v); return send(200, { version: v.version });
      }
      if (m === 'POST' && p === '/api/password') {
        if (!okAuth(b.auth) || !okAuth(b.newAuth) || !okBlob(b.blob) || typeof b.newSalt !== 'string') return send(400, { error: 'Neispravni podaci.' });
        const r = await checkPw(env, uid, u, b.auth); if (r !== 'ok') return send(r === 'locked' ? 429 : 401, { error: 'Trenutna šifra nije tačna.' });
        u.salt = b.newSalt; u.ssalt = rnd(16); u.hash = await hashAuth(b.newAuth, u.ssalt); await P(env, 'u:' + uid, u);
        const v = await J(env, 'v:' + uid); v.blob = b.blob; v.version++; await P(env, 'v:' + uid, v);
        await revokeAll(env, uid, a.tk); return send(200, { version: v.version });
      }
      if (m === 'POST' && p === '/api/2fa/setup') { u.pending = b32enc(crypto.getRandomValues(new Uint8Array(20))); await P(env, 'u:' + uid, u);
        return send(200, { secret: u.pending, uri: `otpauth://totp/fara%20Trezor:${encodeURIComponent(u.u)}?secret=${u.pending}&issuer=fara%20Trezor` }); }
      if (m === 'POST' && p === '/api/2fa/enable') {
        if (!u.pending) return send(400, { error: 'Prvo pokreni postavljanje.' });
        const t = u.totp; u.totp = u.pending; if (!(await totpCheck(u, b.code))) { u.totp = t; return send(401, { error: 'Neispravan kod.' }); }
        delete u.pending; const codes = Array.from({ length: 8 }, () => rnd(5)); u.recovery = await Promise.all(codes.map(sha256)); await P(env, 'u:' + uid, u); return send(200, { codes });
      }
      if (m === 'POST' && p === '/api/2fa/disable') {
        if (!okAuth(b.auth) || (await checkPw(env, uid, u, b.auth)) !== 'ok') return send(401, { error: 'Šifra nije tačna.' });
        if (u.totp && !(await totpCheck(u, b.code))) return send(401, { error: 'Neispravan kod.' });
        delete u.totp; delete u.recovery; await P(env, 'u:' + uid, u); return send(200, { ok: true });
      }
      if (m === 'GET' && p === '/api/sessions') {
        const s = (await J(env, 's:' + uid)) || {}, out = [];
        for (const k of Object.keys(s)) { if (!(await env.KV.get('t:' + k))) { delete s[k]; continue; } out.push({ id: k.slice(0, 12), created: s[k].created, last: s[k].last, ua: s[k].ua, ip: s[k].ip, current: k === a.tk }); }
        await P(env, 's:' + uid, s); return send(200, { sessions: out.sort((x, y) => y.last - x.last) });
      }
      if (m === 'POST' && p === '/api/sessions/revoke') {
        const s = (await J(env, 's:' + uid)) || {};
        for (const k of Object.keys(s)) if (k.startsWith(String(b.id)) && k !== a.tk) { await env.KV.delete('t:' + k); delete s[k]; }
        await P(env, 's:' + uid, s); return send(200, { ok: true });
      }
      if (m === 'POST' && p === '/api/logout') { await env.KV.delete('t:' + a.tk); const s = (await J(env, 's:' + uid)) || {}; delete s[a.tk]; await P(env, 's:' + uid, s); return send(200, { ok: true }); }
      if (m === 'POST' && p === '/api/logout-all') { await revokeAll(env, uid, null); return send(200, { ok: true }); }
      if (m === 'DELETE' && p === '/api/account') {
        if (!okAuth(b.auth) || (await checkPw(env, uid, u, b.auth)) !== 'ok') return send(401, { error: 'Šifra nije tačna.' });
        await revokeAll(env, uid, null); await env.KV.delete('s:' + uid); await env.KV.delete('u:' + uid); await env.KV.delete('v:' + uid); return send(200, { ok: true });
      }
      return send(404, { error: 'Nepoznata putanja.' });
    } catch (e) { return send(500, { error: 'Greška na serveru.' }); }
  }
};
