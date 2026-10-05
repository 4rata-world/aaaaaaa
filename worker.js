// Cloudflare Worker: Karisuke ウェブ認証
// 必要な設定: 変数 DISCORD_CLIENT_ID, TURNSTILE_SITEKEY, MIN_AGE_DAYS(任意)
//             シークレット DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, SIGN_SECRET, TURNSTILE_SECRET

const API = 'https://discord.com/api/v10';
const enc = new TextEncoder();

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const same = (a, b) => a.length === b.length && [...a].reduce((x, c, i) => x | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DANGEROUS = [8n, 32n, 268435456n, 16n, 8192n, 536870912n, 134217728n, 2n, 4n, 1n << 40n, 131072n, 1n << 34n];

function page(title, body, status = 200) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1117;color:#e8eaf0;font-family:system-ui,sans-serif}
.c{width:min(92vw,420px);background:#1a1d27;border-radius:16px;padding:28px;box-sizing:border-box;text-align:center}
h1{font-size:20px;margin:0 0 12px}p{color:#aab;line-height:1.7;font-size:14px}
a.b,button{display:inline-block;background:#5865f2;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:15px;text-decoration:none;cursor:pointer;margin-top:12px}
small{display:block;margin-top:18px;color:#778;font-size:12px;line-height:1.6}</style></head><body><div class="c">${body}</div></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
const fail = (msg, status = 400) => page('認証できません', `<h1>⚠️ 認証できません</h1><p>${esc(msg)}</p>`, status);

async function discord(env, path, opts = {}) {
  return fetch(API + path, { ...opts, headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'content-type': 'application/json', ...(opts.headers || {}) } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = url.origin;

    // 1) ボットが作ったリンクから来る
    if (url.pathname === '/v') {
      const g = url.searchParams.get('g'), r = url.searchParams.get('r'), s = url.searchParams.get('s');
      if (!/^\d+$/.test(g || '') || !/^\d+$/.test(r || '') || !s) return fail('リンクが正しくありません。');
      if (!same(await hmac(env.SIGN_SECRET, `${g}:${r}`), s)) return fail('リンクが正しくありません。');
      const state = `${g}:${r}:${s}`;
      const auth = new URL('https://discord.com/oauth2/authorize');
      auth.search = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID, response_type: 'code', scope: 'identify',
        redirect_uri: `${origin}/cb`, state, prompt: 'none',
      });
      return page('認証', `<h1>🔐 認証</h1><p>Discordでログインして、人間かどうかを確認します。<br>読み取るのは、Discordのユーザー名・ID・アカウント作成日だけです。</p><a class="b" href="${esc(auth)}">Discordでログイン</a>
<small>パスワードなどは取得しません。確認が終わったら、情報は保存せずに破棄します。</small>`);
    }

    // 2) Discordから戻ってくる
    if (url.pathname === '/cb') {
      const code = url.searchParams.get('code'), state = url.searchParams.get('state') || '';
      const [g, r, s] = state.split(':');
      if (!code || !g || !r || !s) return fail('ログインがキャンセルされました。もう一度リンクから始めてください。');
      if (!same(await hmac(env.SIGN_SECRET, `${g}:${r}`), s)) return fail('リンクが正しくありません。');

      const tok = await fetch(`${API}/oauth2/token`, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: `${origin}/cb` }),
      });
      if (!tok.ok) return fail('ログインに失敗しました。もう一度やり直してください。');
      const { access_token } = await tok.json();
      const me = await (await fetch(`${API}/users/@me`, { headers: { authorization: `Bearer ${access_token}` } })).json();
      if (!me.id) return fail('ユーザー情報を取得できませんでした。');

      const minDays = Number(env.MIN_AGE_DAYS ?? 7);
      const created = Number((BigInt(me.id) >> 22n) + 1420070400000n);
      const ageDays = (Date.now() - created) / 86400000;
      if (ageDays < minDays) return fail(`アカウントを作ってから${minDays}日以上たっていないため、認証できません。しばらくしてからもう一度お試しください。`, 403);

      const exp = Date.now() + 10 * 60 * 1000;
      const sig = await hmac(env.SIGN_SECRET, `${me.id}:${g}:${r}:${exp}`);
      return page('認証', `<h1>🤖 人間チェック</h1><p>${esc(me.username)} さん、あと一つです。</p>
<form method="POST" action="/done"><input type="hidden" name="u" value="${me.id}"><input type="hidden" name="g" value="${g}"><input type="hidden" name="r" value="${r}">
<input type="hidden" name="e" value="${exp}"><input type="hidden" name="s" value="${sig}">
<div class="cf-turnstile" data-sitekey="${esc(env.TURNSTILE_SITEKEY)}" data-theme="dark"></div><button type="submit">認証する</button></form>`);
    }

    // 3) 人間チェック→ロール付与
    if (url.pathname === '/done' && req.method === 'POST') {
      const f = await req.formData();
      const [u, g, r, e, s] = ['u', 'g', 'r', 'e', 's'].map((k) => String(f.get(k) || ''));
      if (!/^\d+$/.test(u + g + r + e) || Date.now() > Number(e)) return fail('有効期限が切れました。もう一度リンクから始めてください。');
      if (!same(await hmac(env.SIGN_SECRET, `${u}:${g}:${r}:${e}`), s)) return fail('不正なリクエストです。');

      const ts = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(f.get('cf-turnstile-response') || ''), remoteip: req.headers.get('CF-Connecting-IP') || '' }),
      })).json();
      if (!ts.success) return fail('人間チェックに失敗しました。もう一度お試しください。');

      // ロールの安全確認
      const rolesRes = await discord(env, `/guilds/${g}/roles`);
      if (!rolesRes.ok) return fail('サーバーの情報を取得できませんでした。Botがサーバーにいるか確認してください。', 500);
      const role = (await rolesRes.json()).find((x) => x.id === r);
      if (!role || role.managed || r === g || DANGEROUS.some((p) => (BigInt(role.permissions) & p) !== 0n))
        return fail('このロールは付けられない設定です。サーバーの管理者に連絡してください。', 403);

      const m = await discord(env, `/guilds/${g}/members/${u}`);
      if (!m.ok) return fail('このサーバーに参加していないようです。参加してからやり直してください。', 403);

      const put = await discord(env, `/guilds/${g}/members/${u}/roles/${r}`, { method: 'PUT', headers: { 'x-audit-log-reason': encodeURIComponent('ウェブ認証') } });
      if (!put.ok) return fail('ロールを付けられませんでした。Botのロールが、付けたいロールより上にあるか確認してください。', 500);
      return page('完了', `<h1>✅ 認証しました</h1><p>ロール「${esc(role.name)}」を付けました。Discordに戻ってください。</p>`);
    }

    return fail('ページが見つかりません。', 404);
  },
};
