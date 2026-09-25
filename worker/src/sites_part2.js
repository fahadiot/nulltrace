const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// ---- helpers ----------------------------------------------------------------

// Collect "name=value" cookie pairs from a response's Set-Cookie header(s).
function grabCookies(res) {
  const sc = res.headers.getSetCookie?.() || [res.headers.get("set-cookie")].filter(Boolean);
  return sc.map(c => c.split(";")[0]).join("; ");
}

// ---- modules ----------------------------------------------------------------

export const PART = [
  { name:"issuu", domain:"issuu.com", category:"software",
    check: async (email, signal) => {
      try {
        const input = JSON.stringify({ json: { email } });
        const url = 'https://issuu.com/api/user-service/public.user.auth.checkEmailAvailability?input=' + encodeURIComponent(input);
        const response = await fetch(url, {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'en,en-US;q=0.5',
            'Referer': 'https://issuu.com/signup',
            'x-trpc-source': 'nextjs-react',
            'Cache-Control': 'no-cache',
            'DNT': '1',
          }
        });
        let available;
        try { available = (await response.json()).result.data.json.isEmailAvailable; }
        catch { return { status:"blocked" }; }
        if (available === false) return { status:"used" };
        if (available === true) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"komoot", domain:"komoot.com", category:"medias",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://www.komoot.com/v1/signin', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
            'Content-Type': 'application/json',
            'Origin': 'https://www.komoot.com',
            'Referer': 'https://www.komoot.com/signin',
          },
          body: JSON.stringify({ email })
        });
        let kind;
        try { kind = (await response.json()).type; } catch { return { status:"blocked" }; }
        if (kind === 'login') return { status:"used" };
        if (kind === 'register') return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"lastpass", domain:"lastpass.com", category:"software",
    check: async (email, signal) => {
      try {
        const params = new URLSearchParams({
          check: 'avail', skipcontent: '1', mistype: '1', username: email
        });
        const response = await fetch('https://lastpass.com/create_account.php?' + params.toString(), {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'en,en-US;q=0.5',
            'Referer': 'https://lastpass.com/',
            'X-Requested-With': 'XMLHttpRequest',
            'DNT': '1',
          }
        });
        const t = (await response.text()).trim();
        if (t === "no") return { status:"used" };
        if (t === "ok" || t === "emailinvalid") return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"mail_ru", domain:"mail.ru", category:"mails",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://account.mail.ru/api/v1/user/password/restore', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'origin': 'https://account.mail.ru',
            'referer': 'https://account.mail.ru/recovery',
            'user-agent': UA,
            'accept-language': 'ru',
          },
          body: new URLSearchParams({ email, htmlencoded: 'false' })
        });
        if (response.status !== 200) return { status:"blocked" };
        let reqd;
        try { reqd = await response.json(); } catch { return { status:"blocked" }; }
        if (reqd.status === 200) {
          const body = reqd.body || {};
          const phones = (body.phones || []).map(String).join(', ') || null;
          const emails = (body.emails || []).map(String).join(', ') || null;
          const bits = [];
          if (emails) bits.push("emailrecovery: " + emails);
          if (phones) bits.push("phoneNumber: " + phones);
          return bits.length ? { status:"used", extra: bits.join(" / ") } : { status:"used" };
        }
        if (JSON.stringify(reqd.body).includes("not_exists")) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"myspace", domain:"myspace.com", category:"social_media",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'en,en-US;q=0.5',
          'Origin': 'https://myspace.com',
          'DNT': '1',
          'Referer': 'https://myspace.com/signup',
        };
        const r = await fetch('https://myspace.com/signup', { signal, headers, redirect:'follow' });
        const html = await r.text();
        let hash;
        try { hash = html.split('<input name="csrf" type="hidden" value="')[1].split('"')[0]; }
        catch { return { status:"blocked" }; }
        if (hash === undefined) return { status:"blocked" };
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
        headers['Hash'] = hash;
        headers['X-Requested-With'] = 'XMLHttpRequest';
        const response = await fetch('https://myspace.com/ajax/account/validateemail', {
          signal, method:'POST', headers, redirect:'follow',
          body: new URLSearchParams({ email })
        });
        const t = await response.text();
        if (t.includes("This email address was already used to create an account.")) return { status:"used" };
        if (t.includes('"validationResult":"Success"')) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"naturabuy", domain:"naturabuy.fr", category:"shopping",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
          'Origin': 'https://www.naturabuy.fr',
          'Referer': 'https://www.naturabuy.fr/register.php',
        };
        const page = await fetch('https://www.naturabuy.fr/register.php', { signal, headers, redirect:'follow' });
        const cookie = grabCookies(page);
        const html = await page.text();
        const m = html.match(/name="guard" value="([^"]+)"/);
        if (!m) return { status:"blocked" };
        const guard = m[1];
        // the endpoint expects multipart/form-data (FormData in the browser)
        const fd = new FormData();
        fd.append('action', 'checkValue');
        fd.append('jsref', 'email');
        fd.append('jsvalue', email);
        fd.append('registerMode', 'full');
        fd.append('guard', guard);
        fd.append('_', '');
        const response = await fetch('https://www.naturabuy.fr/ajax/front/register/Register.php', {
          signal, method:'POST', redirect:'follow',
          headers: { ...headers, 'X-Requested-With': 'XMLHttpRequest', ...(cookie ? { 'Cookie': cookie } : {}) },
          body: fd
        });
        let free;
        try { free = (await response.json()).free; } catch { return { status:"blocked" }; }
        if (free === false) return { status:"used" };
        if (free === true) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"nextpvr", domain:"forums.nextpvr.com", category:"forum",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://forums.nextpvr.com/member.php',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://forums.nextpvr.com',
          'DNT': '1',
        };
        const r = await fetch('https://forums.nextpvr.com/member.php', { signal, headers, redirect:'follow' });
        const text = await r.text();
        if (text.includes("Your request was blocked") || r.status !== 200) return { status:"blocked" };
        let key;
        try { key = text.split('var my_post_key = "')[1].split('"')[0]; } catch { return { status:"blocked" }; }
        if (key === undefined) return { status:"blocked" };
        headers['X-Requested-With'] = 'XMLHttpRequest';
        const resp = await fetch('https://forums.nextpvr.com/xmlhttp.php?action=email_availability', {
          signal, method:'POST', headers, redirect:'follow',
          body: new URLSearchParams({ email, my_post_key: key })
        });
        const rt = await resp.text();
        if (!rt.includes("Your request was blocked") && resp.status === 200) {
          return rt.includes("email address that is already in use by another member.")
            ? { status:"used" } : { status:"free" };
        }
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"odnoklassniki", domain:"ok.ru", category:"social_media",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://ok.ru/',
          'DNT': '1',
        };
        const OK_LOGIN_URL = 'https://www.ok.ru/dk?st.cmd=anonymMain&st.accRecovery=on&st.error=errors.password.wrong';
        const OK_RECOVER_URL = 'https://www.ok.ru/dk?st.cmd=anonymRecoveryAfterFailedLogin&st._aid=LeftColumn_Login_ForgotPassword';
        await fetch(OK_LOGIN_URL + '&st.email=' + encodeURIComponent(email), { signal, headers, redirect:'follow' });
        const request = await fetch(OK_RECOVER_URL, { signal, headers, redirect:'follow' });
        const body = await request.text();
        // offer_contact_rest container present => a matching account was found
        if (body.includes('registrationContainer,offer_contact_rest')) {
          // account exists only when the account-info block is rendered
          if (body.includes('ext-registration_tx taCenter')) {
            let name;
            const nm = body.match(/ext-registration_username_header[^>]*>([^<]+)</);
            if (nm) name = nm[1].trim();
            const em = body.match(/data-l="t,email"[\s\S]*?ext-registration_stub_small_header[^>]*>([^<]+)</);
            const ph = body.match(/data-l="t,phone"[\s\S]*?ext-registration_stub_small_header[^>]*>([^<]+)</);
            const bits = [];
            if (name) bits.push("name: " + name);
            if (em) bits.push("emailrecovery: " + em[1].trim());
            if (ph) bits.push("phoneNumber: " + ph[1].trim());
            return bits.length ? { status:"used", extra: bits.join(" / ") } : { status:"used" };
          }
          return { status:"free" };
        }
        if (body.includes('registrationContainer,home_rest')) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"office365", domain:"office365.com", category:"software",
    check: async (email, signal) => {
      try {
        const digits = () => { let s = ""; for (let i = 0; i < 30; i++) s += Math.floor(Math.random()*10); return s; };
        const headers = {
          'User-Agent': 'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.12026; Pro)',
          'Accept': 'application/json',
        };
        const domain = email.split('@')[1];
        const r = await fetch('https://outlook.office365.com/autodiscover/autodiscover.json/v1.0/' +
          encodeURIComponent(digits() + "@" + domain) + '?Protocol=Autodiscoverv1', {
          signal, method:'GET', headers, redirect:'manual'
        });
        if (r.status !== 200) {
          const r2 = await fetch('https://outlook.office365.com/autodiscover/autodiscover.json/v1.0/' +
            encodeURIComponent(email) + '?Protocol=Autodiscoverv1', {
            signal, method:'GET', headers, redirect:'manual'
          });
          return r2.status === 200 ? { status:"used" } : { status:"free" };
        }
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"plurk", domain:"plurk.com", category:"social_media",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://www.plurk.com/Users/isEmailFound', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.plurk.com',
            'DNT': '1',
          },
          body: new URLSearchParams({ email })
        });
        const t = (await response.text()).trim();
        if (t === "True") return { status:"used" };
        if (t === "False") return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"rambler", domain:"rambler.ru", category:"medias",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://id.rambler.ru/jsonrpc', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'en,en-US;q=0.5',
            'Referer': 'https://id.rambler.ru/champ/registration',
            'Content-Type': 'application/json',
            'Origin': 'https://id.rambler.ru',
            'DNT': '1',
          },
          body: JSON.stringify({
            method: "Rambler::Id::get_email_account_info",
            params: [{ email }],
            rpc: "2.0"
          })
        });
        let exists;
        try { exists = (await response.json()).result.exists; } catch { return { status:"blocked" }; }
        return exists === 0 ? { status:"free" } : { status:"used" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"seoclerks", domain:"seoclerks.com", category:"jobs",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.seoclerks.com',
        };
        const r = await fetch('https://www.seoclerks.com', { signal, headers, redirect:'follow' });
        const html = await r.text();
        let token, cr;
        try {
          if (html.includes("token")) token = html.split('token" value="')[1].split('"')[0];
          if (html.includes("__cr")) cr = html.split('__cr" value="')[1].split('"')[0];
        } catch { return { status:"blocked" }; }
        if (token === undefined || cr === undefined) return { status:"blocked" };
        const rnd = (n) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(97 + Math.floor(Math.random()*26)); return s; };
        const username = rnd(6);
        const password = rnd(6);
        const response = await fetch('https://www.seoclerks.com/signup/check', {
          signal, method:'POST', headers, redirect:'follow',
          body: new URLSearchParams({
            token: String(token), __cr: String(cr), fsub: '1', droplet: '',
            user_username: username, user_email: email,
            user_password: password, confirm_password: password
          })
        });
        const t = await response.text();
        return t.includes('The email address you entered is already taken.')
          ? { status:"used" } : { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"spotify", domain:"spotify.com", category:"music",
    check: async (email, signal) => {
      try {
        const params = new URLSearchParams({ validate: '1', email });
        const req = await fetch('https://spclient.wg.spotify.com/signup/public/v1/account?' + params.toString(), {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
          }
        });
        let status;
        try { status = (await req.json()).status; } catch { return { status:"blocked" }; }
        if (status === 1) return { status:"free" };
        if (status === 20) return { status:"used" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"teamtreehouse", domain:"teamtreehouse.com", category:"programing",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://teamtreehouse.com/subscribe/new?trial=yes',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://teamtreehouse.com',
          'DNT': '1',
        };
        const req = await fetch('https://teamtreehouse.com/subscribe/new?trial=yes', { signal, headers, redirect:'follow' });
        const cookie = grabCookies(req);
        const html = await req.text();
        const m = html.match(/<meta[^>]+name=["']csrf-token["'][^>]*>/i);
        let token;
        if (m) { const cm = m[0].match(/content=["']([^"']+)["']/i); token = cm ? cm[1] : undefined; }
        if (!token) return { status:"blocked" };
        headers['X-CSRF-Token'] = token;
        if (cookie) headers['Cookie'] = cookie;
        const response = await fetch('https://teamtreehouse.com/account/email_address', {
          signal, method:'POST', headers, redirect:'follow',
          body: new URLSearchParams({ email })
        });
        const t = await response.text();
        if (t.includes('that email address is taken.')) return { status:"used" };
        if (t === '{"success":true}') return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"thecardboard", domain:"thecardboard.org", category:"forum",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://thecardboard.org/board/member.php',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://thecardboard.org/board',
          'DNT': '1',
        };
        const r = await fetch('https://thecardboard.org/board/member.php', { signal, headers, redirect:'follow' });
        const text = await r.text();
        if (text.includes("Your request was blocked") || r.status !== 200) return { status:"blocked" };
        let key;
        try { key = text.split('var my_post_key = "')[1].split('"')[0]; } catch { return { status:"blocked" }; }
        if (key === undefined) return { status:"blocked" };
        headers['X-Requested-With'] = 'XMLHttpRequest';
        const resp = await fetch('https://thecardboard.org/board/xmlhttp.php?action=email_availability', {
          signal, method:'POST', headers, redirect:'follow',
          body: new URLSearchParams({ email, my_post_key: key })
        });
        const rt = await resp.text();
        if (!rt.includes("Your request was blocked") && resp.status === 200) {
          return rt.includes("email address that is already in use by another member.")
            ? { status:"used" } : { status:"free" };
        }
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"twitter", domain:"twitter.com", category:"social_media",
    check: async (email, signal) => {
      try {
        const req = await fetch('https://api.twitter.com/i/users/email_available.json?email=' + encodeURIComponent(email), {
          signal, method:'GET', redirect:'follow',
          headers: { 'User-Agent': UA, 'Accept': 'application/json' }
        });
        let taken;
        try { taken = (await req.json()).taken; } catch { return { status:"blocked" }; }
        return taken ? { status:"used" } : { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"wordpress", domain:"wordpress.com", category:"cms",
    check: async (email, signal) => {
      try {
        const cookies = [
          'G_ENABLED_IDPS=google', 'ccpa_applies=true', 'usprivacy=1YNN',
          'landingpage_currency=EUR', 'wordpress_test_cookie=WP+Cookie+check'
        ].join('; ');
        const response = await fetch(
          'https://public-api.wordpress.com/rest/v1.1/users/' + encodeURIComponent(email) +
          '/auth-options?http_envelope=1&locale=fr', {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
            'DNT': '1',
            'Cookie': cookies,
          }
        });
        let info;
        try { info = await response.json(); } catch { return { status:"blocked" }; }
        const body = info.body || {};
        if ("email_verified" in body) {
          return body.email_verified ? { status:"used" } : { status:"free" };
        }
        const s = JSON.stringify(info);
        if (s.includes("email_login_not_allowed")) return { status:"used" };
        if (s.includes("unknown_user")) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"xnxx", domain:"xnxx.com", category:"porn",
    check: async (email, signal) => {
      try {
        const headers = {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-fr',
          'User-Agent': UA,
          'Referer': 'https://www.google.com/',
        };
        const home = await fetch('https://www.xnxx.com', { signal, headers, redirect:'follow' });
        if (home.status !== 200) return { status:"blocked" };
        const cookie = grabCookies(home);
        const url = 'https://www.xnxx.com/account/checkemail?email=' + email.replace('@', '%40');
        const apiRes = await fetch(url, {
          signal, method:'GET', redirect:'follow',
          headers: {
            ...headers,
            'Referer': 'https://www.xnxx.com/video-holehe/palenath_fucks_xnxx_with_holehe',
            'X-Requested-With': 'XMLHttpRequest',
            ...(cookie ? { 'Cookie': cookie } : {}),
          }
        });
        if (apiRes.status !== 200) return { status:"blocked" };
        let api;
        try { api = JSON.parse(await apiRes.text()); } catch { return { status:"blocked" }; }
        if (api.result === false && api.code === 1 &&
            api.message === 'Cet email est d&eacute;j&agrave; utilis&eacute; ou son propri&eacute;taire l&#039;a exclu de notre site.')
          return { status:"used" };
        if (api.result === false && api.code === 1 && api.message === 'Adresse email invalide.')
          return { status:"free" };
        if (api.result === true && api.code === 0) return { status:"free" };
        if (api.result === false && api.code === 2) return { status:"blocked" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"xvideos", domain:"xvideos.com", category:"porn",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://www.xvideos.com/account/checkemail?email=' + encodeURIComponent(email), {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.xvideos.com/',
          }
        });
        const text = await response.text();
        let result;
        try { result = JSON.parse(text).result; } catch { return { status:"blocked" }; }
        if (result === false && text.includes("This email is already in use or its owner has excluded it from our website"))
          return { status:"used" };
        return { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },
];
