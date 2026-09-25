const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// ---- helpers ----------------------------------------------------------------

// Collect "name=value" cookie pairs from a response's Set-Cookie header(s).
function grabCookies(res) {
  const sc = res.headers.getSetCookie?.() || [res.headers.get("set-cookie")].filter(Boolean);
  return sc.map(c => c.split(";")[0]).join("; ");
}

function cookieValue(res, name) {
  const sc = res.headers.getSetCookie?.() || [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of sc) {
    const first = c.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > -1 && first.slice(0, eq).trim() === name) return first.slice(eq + 1).trim();
  }
  return null;
}

// Pure-JS MD5 (WebCrypto has no MD5; gravatar hashes the email with it).
function md5(str) {
  function toBytes(s) {
    const utf8 = unescape(encodeURIComponent(s));
    const out = [];
    for (let i = 0; i < utf8.length; i++) out.push(utf8.charCodeAt(i) & 0xff);
    return out;
  }
  function add(x, y) { return (x + y) & 0xffffffff; }
  function rol(x, c) { return (x << c) | (x >>> (32 - c)); }
  const bytes = toBytes(str);
  const origLen = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = origLen * 8;
  for (let i = 0; i < 8; i++) bytes.push((bitLen / Math.pow(2, 8 * i)) & 0xff);

  const K = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * Math.pow(2, 32)) >>> 0;
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let off = 0; off < bytes.length; off += 64) {
    const M = [];
    for (let i = 0; i < 16; i++) {
      M[i] = bytes[off + i*4] | (bytes[off + i*4 + 1] << 8) | (bytes[off + i*4 + 2] << 16) | (bytes[off + i*4 + 3] << 24);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5*i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3*i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7*i) % 16; }
      F = add(add(add(F, A), K[i]), M[g]);
      A = D; D = C; C = B;
      B = add(B, rol(F, S[i]));
    }
    a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
  }

  function hex(n) {
    let s = "";
    for (let i = 0; i < 4; i++) s += ((n >>> (i*8)) & 0xff).toString(16).padStart(2, "0");
    return s;
  }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

// ---- modules ----------------------------------------------------------------

export const PART = [
  { name:"adobe", domain:"adobe.com", category:"software",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.5',
          'X-IMS-CLIENTID': 'adobedotcom2',
          'Content-Type': 'application/json;charset=utf-8',
          'Origin': 'https://auth.services.adobe.com',
          'DNT': '1',
        };
        const r = await fetch('https://auth.services.adobe.com/signin/v1/authenticationstate', {
          signal, method:'POST', headers, redirect:'follow',
          body: JSON.stringify({ username: email, accountType: "individual" })
        });
        let j;
        try { j = await r.json(); } catch { j = {}; }
        // errorCode key on the first response -> address free
        if (JSON.stringify(Object.keys(j || {})).includes("errorCode")) return { status:"free" };

        const enc = r.headers.get('x-ims-authentication-state-encrypted');
        if (!enc) return { status:"blocked" };
        headers['X-IMS-Authentication-State-Encrypted'] = enc;
        const resp = await fetch('https://auth.services.adobe.com/signin/v2/challenges?purpose=passwordRecovery', {
          signal, method:'GET', headers, redirect:'follow'
        });
        try { await resp.json(); } catch { /* ignore */ }
        // either branch in Python marks exists:True
        return { status:"used" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"amocrm", domain:"amocrm.com", category:"crm",
    check: async (email, signal) => {
      try {
        const res = await fetch('https://www.kommo.com/account/check_login.php', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'Accept': '*/*',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://www.kommo.com',
            'Referer': 'https://www.kommo.com/',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          body: new URLSearchParams({ LOGIN: email })
        });
        let status = null;
        if (res.status === 200) { try { status = (await res.json()).status; } catch { status = null; } }
        if (status === "used") return { status:"used" };
        if (status === "free") return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"anydo", domain:"any.do", category:"productivity",
    check: async (email, signal) => {
      try {
        const res = await fetch('https://sm-prod2.any.do/check_email', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'en,en-US;q=0.5',
            'Referer': 'https://desktop.any.do/',
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Platform': '3',
            'Origin': 'https://desktop.any.do',
            'DNT': '1',
          },
          body: JSON.stringify({ email })
        });
        if (res.status === 200) {
          const j = await res.json();
          return j.user_exists ? { status:"used" } : { status:"free" };
        }
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"biosmods", domain:"bios-mods.com", category:"forum",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://bios-mods.com/forum/member.php',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://bios-mods.com/forum/',
          'DNT': '1',
        };
        const r = await fetch('https://bios-mods.com/forum/member.php', { signal, headers, redirect:'follow' });
        const text = await r.text();
        if (text.includes("Your request was blocked") || r.status !== 200) return { status:"blocked" };
        let key;
        try { key = text.split('var my_post_key = "')[1].split('"')[0]; } catch { return { status:"blocked" }; }
        if (key === undefined) return { status:"blocked" };
        headers['X-Requested-With'] = 'XMLHttpRequest';
        const resp = await fetch('https://bios-mods.com/forum/xmlhttp.php?action=email_availability', {
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

  { name:"blitzortung", domain:"forum.blitzortung.org", category:"forum",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://forum.blitzortung.org/mybb/member.php',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://forum.blitzortung.org',
          'DNT': '1',
        };
        const r = await fetch('https://forum.blitzortung.org/mybb/member.php', { signal, headers, redirect:'follow' });
        const text = await r.text();
        if (text.includes("Your request was blocked") || r.status !== 200) return { status:"blocked" };
        let key;
        try { key = text.split('var my_post_key = "')[1].split('"')[0]; } catch { return { status:"blocked" }; }
        if (key === undefined) return { status:"blocked" };
        headers['X-Requested-With'] = 'XMLHttpRequest';
        const resp = await fetch('https://forum.blitzortung.org/mybb/xmlhttp.php?action=email_availability', {
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

  { name:"chesscom", domain:"chess.com", category:"sport",
    check: async (email, signal) => {
      try {
        const res = await fetch('https://www.chess.com/callback/email/available?email=' + encodeURIComponent(email), {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.chess.com/register',
            'X-Requested-With': 'XMLHttpRequest',
          }
        });
        let data;
        try { data = await res.json(); } catch { return { status:"blocked" }; }
        const available = data.isEmailAvailable;
        const reason = String(data.reason ?? "");
        if (available === false && reason.includes("In Use")) return { status:"used" };
        if (available === true) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"clashfarmer", domain:"clashfarmer.com", category:"forum",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://www.clashfarmer.com/forum/member.php',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://www.clashfarmer.com/forum',
          'DNT': '1',
        };
        const r = await fetch('https://www.clashfarmer.com/forum/member.php', { signal, headers, redirect:'follow' });
        const text = await r.text();
        if (text.includes("Your request was blocked") || r.status !== 200) return { status:"blocked" };
        let key;
        try { key = text.split('var my_post_key = "')[1].split('"')[0]; } catch { return { status:"blocked" }; }
        if (key === undefined) return { status:"blocked" };
        headers['X-Requested-With'] = 'XMLHttpRequest';
        const resp = await fetch('https://www.clashfarmer.com/forum/xmlhttp.php?action=email_availability', {
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

  { name:"codecademy", domain:"codecademy.com", category:"programing",
    check: async (email, signal) => {
      try {
        const headers = {
          'User-Agent': UA,
          'Accept': 'application/json',
          'Accept-Language': 'en,en-US;q=0.5',
          'Referer': 'https://www.codecademy.com/register?redirect=%2',
          'Content-Type': 'application/json',
          'Origin': 'https://www.codecademy.com',
          'DNT': '1',
        };
        let token;
        try {
          const req = await fetch('https://www.codecademy.com/register?redirect=%2F', {
            signal, method:'GET', headers, redirect:'follow'
          });
          const html = await req.text();
          const m = html.match(/<meta[^>]+name=["']csrf-token["'][^>]*>/i);
          if (m) {
            const cm = m[0].match(/content=["']([^"']+)["']/i);
            token = cm ? cm[1] : undefined;
          }
          if (!token) return { status:"blocked" };
          headers["X-CSRF-Token"] = token;
        } catch { return { status:"blocked" }; }

        let response;
        try {
          response = await fetch('https://www.codecademy.com/register/validate', {
            signal, method:'POST', headers, redirect:'follow',
            body: JSON.stringify({ user: { email } })
          });
        } catch { response = null; }
        if (response) {
          const rt = await response.text();
          if (response.status === 400 && rt.includes('already been taken')) return { status:"used" };
          if (response.status === 200) return { status:"free" };
        }
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"deezer", domain:"deezer.com", category:"music",
    check: async (email, signal) => {
      try {
        const res = await fetch('https://www.deezer.com/ajax/gw-light.php?method=deezer.emailCheck&api_version=1.0&api_token=', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Origin': 'https://www.deezer.com',
            'Referer': 'https://www.deezer.com/',
          },
          body: JSON.stringify({ EMAIL: email })
        });
        let availability;
        try { availability = (await res.json())?.results?.availability; } catch { return { status:"blocked" }; }
        if (availability === null || availability === undefined) return { status:"blocked" };
        if (availability === false) return { status:"used" };
        return { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"devrant", domain:"devrant.com", category:"programing",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://devrant.com/api/users', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://devrant.com',
            'Referer': 'https://devrant.com/feed/top/month?login=1',
          },
          body: new URLSearchParams({
            app:'3', type:'1', email, username:'', password:'', guid:'', plat:'3', sid:'', seid:''
          })
        });
        let result;
        try { result = (await response.json()).error; } catch { return { status:"blocked" }; }
        return result === 'The email specified is already registered to an account.'
          ? { status:"used" } : { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"diigo", domain:"diigo.com", category:"learning",
    check: async (email, signal) => {
      try {
        const res = await fetch('https://www.diigo.com/user_mana2/check_email?email=' + encodeURIComponent(email), {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'en,en-US;q=0.5',
            'DNT': '1',
            'Referer': 'https://www.diigo.com/sign-up?plan=free',
            'X-Requested-With': 'XMLHttpRequest',
          }
        });
        if (res.status === 200) {
          const t = (await res.text()).trim();
          return t === "0" ? { status:"used" } : { status:"free" };
        }
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"duolingo", domain:"duolingo.com", category:"learning",
    check: async (email, signal) => {
      try {
        const req = await fetch('https://www.duolingo.com/2017-06-30/users?email=' + encodeURIComponent(email), {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.8',
          }
        });
        const j = await req.json();
        return (j.users && j.users.length) ? { status:"used" } : { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"edx", domain:"edx.org", category:"learning",
    check: async (email, signal) => {
      try {
        const res = await fetch('https://courses.edx.org/api/user/v1/validation/registration', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://www.edx.org',
            'Referer': 'https://www.edx.org/',
          },
          body: new URLSearchParams({ email })
        });
        let decision;
        try { decision = (await res.json())?.validation_decisions?.email; } catch { return { status:"blocked" }; }
        if (decision === null || decision === undefined) return { status:"blocked" };
        return decision.toLowerCase().includes("already") ? { status:"used" } : { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"eventbrite", domain:"eventbrite.com", category:"products",
    check: async (email, signal) => {
      try {
        let csrf;
        try {
          const req = await fetch('https://www.eventbrite.com/signin/?referrer=%2F', {
            signal, method:'GET', redirect:'follow',
            headers: {
              'User-Agent': UA,
              'Accept': '*/*',
              'Accept-Language': 'en,en-US;q=0.5',
              'Referer': 'https://www.eventbrite.com/',
              'DNT': '1',
            }
          });
          csrf = cookieValue(req, "csrftoken");
          if (!csrf) return { status:"blocked" };
        } catch { return { status:"blocked" }; }

        const response = await fetch('https://www.eventbrite.com/api/v3/users/lookup/', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'en,en-US;q=0.5',
            'Referer': 'https://www.eventbrite.com/',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.eventbrite.com',
            'DNT': '1',
            'X-CSRFToken': csrf,
            'Cookie': 'csrftoken=' + csrf,
          },
          body: JSON.stringify({ email })
        });
        if (response.status === 200) {
          try {
            const j = await response.json();
            return j.exists ? { status:"used" } : { status:"free" };
          } catch { return { status:"blocked" }; }
        }
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"firefox", domain:"firefox.com", category:"software",
    check: async (email, signal) => {
      try {
        // NB: the firefox accounts API returns 406 when sent a browser User-Agent,
        // so (matching the Python module, which sends no headers) we omit the UA here.
        const req = await fetch('https://api.accounts.firefox.com/v1/account/status', {
          signal, method:'POST', redirect:'follow',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email })
        });
        const t = await req.text();
        if (t.includes("false")) return { status:"free" };
        if (t.includes("true")) return { status:"used" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"flickr", domain:"flickr.com", category:"medias",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://identity-api.flickr.com/migration?email=' + encodeURIComponent(email), {
          signal, method:'GET', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
            'Referer': 'https://identity.flickr.com/login',
            'Origin': 'https://identity.flickr.com',
          }
        });
        let data;
        try { data = JSON.parse(await response.text()); } catch { return { status:"blocked" }; }
        if (data && data.state_code === '5') return { status:"used" };
        return { status:"free" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"freelancer", domain:"freelancer.com", category:"jobs",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://www.freelancer.com/api/users/0.1/users/check?compact=true&new_errors=true', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
            'Content-Type': 'application/json',
            'Origin': 'https://www.freelancer.com',
            'DNT': '1',
          },
          body: JSON.stringify({ user: { email } })
        });
        const rt = await response.text();
        if (response.status === 409 && rt.includes("EMAIL_ALREADY_IN_USE")) return { status:"used" };
        if (response.status === 200) return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"gravatar", domain:"en.gravatar.com", category:"cms",
    check: async (email, signal) => {
      try {
        const hashed = md5(email);
        const r = await fetch('https://en.gravatar.com/' + hashed + '.json', {
          signal, method:'GET', redirect:'follow',
          headers: { 'User-Agent': UA }
        });
        if (r.status !== 200) return { status:"free" };
        try {
          const data = await r.json();
          const fullName = data.entry[0].displayName;
          const profileUrl = data.entry[0].profileUrl;
          return { status:"used", extra: "name: " + String(fullName) + " / " + String(profileUrl) };
        } catch { return { status:"blocked" }; }
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"hubspot", domain:"hubspot.com", category:"crm",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://api.hubspot.com/login-api/v1/login', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'User-Agent': UA,
            'content-type': 'application/json',
            'origin': 'https://app.hubspot.com',
            'referer': 'https://app.hubspot.com/',
            'accept-language': 'en-US;q=0.8,en;q=0.7',
          },
          body: JSON.stringify({ email, password: "", rememberLogin: false })
        });
        let status = null;
        try { status = (await response.json()).status; } catch { status = null; }
        if (status === "INVALID_PASSWORD" || status === "PASSWORD_DEPRECATED" || status === "SUSPICIOUS_ACTIVITY")
          return { status:"used" };
        if (status === "INVALID_USER") return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },

  { name:"insightly", domain:"insightly.com", category:"crm",
    check: async (email, signal) => {
      try {
        const response = await fetch('https://accounts.insightly.com/signup/isemailvalid', {
          signal, method:'POST', redirect:'follow',
          headers: {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'User-Agent': UA,
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'origin': 'https://accounts.insightly.com',
            'referer': 'https://accounts.insightly.com/?plan=trial',
            'accept-language': 'en-US;q=0.8,en;q=0.7',
          },
          body: new URLSearchParams({ emailaddress: email })
        });
        const t = (await response.text()).trim();
        if (t.includes("An account exists for this address. Use another address or")) return { status:"used" };
        if (t === "true") return { status:"free" };
        return { status:"blocked" };
      } catch { return { status:"blocked" }; }
    }
  },
];
