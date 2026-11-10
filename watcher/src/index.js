// watcher/src/index.js
// Cloudflare Worker that runs every minute (cron), checks the latest reading in
// Firestore and sends an Expo push to every user whose temperature limit is exceeded.
// Uses only the Firestore REST API, so Firebase can stay on the free Spark plan.

const COOLDOWN_MS = 10 * 60 * 1000; // at most one alert per user every 10 minutes
const DEFAULT_LIMIT = 50; // same default as the app's Settings screen

export default {
  async scheduled(event, env, ctx) {
    await checkReadings(env);
  },
};

async function checkReadings(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const fs = firestore(sa.project_id, await getAccessToken(sa));

  const latest = await fs.latestReading();
  if (!latest) return console.log('No readings yet');

  // state = { lastReading: <timestamp of last processed reading>, lastAlert: { uid: ms } }
  const state = (await fs.getState()) ?? { lastReading: null, lastAlert: {} };
  const readingKey = JSON.stringify(latest.timestamp ?? latest.id);
  if (state.lastReading === readingKey) return console.log('No new reading');
  state.lastReading = readingKey;

  const temperature = Number(latest.temperature);
  const now = Date.now();
  const limits = await fs.temperatureLimits();
  const toAlert = [];

  for (const [uid, limit] of Object.entries(limits)) {
    const sinceLast = now - (state.lastAlert[uid] ?? 0);
    if (!(temperature > limit)) {
      console.log(`${uid}: ${temperature}°C <= limit ${limit}°C, normal`);
      delete state.lastAlert[uid]; // back to normal: alert straight away next time
    } else if (sinceLast > COOLDOWN_MS) {
      toAlert.push({ uid, limit });
    } else {
      console.log(`${uid}: over limit ${limit}°C, cooldown (last alert ${Math.round(sinceLast / 60000)} min ago)`);
    }
  }
  if (Object.keys(limits).length === 0) console.log('No users found in Firestore "users"/"settings"');

  if (toAlert.length > 0) {
    const tokens = await fs.pushTokens();
    for (const { uid } of toAlert) if (!tokens[uid]) console.log(`${uid}: no pushToken saved, skipped`);
    const messages = toAlert
      .filter(({ uid }) => tokens[uid])
      .map(({ uid, limit }) => ({
        to: tokens[uid],
        title: '🚨 Milk temperature alert',
        body: `Temperature is ${temperature.toFixed(1)}°C (limit ${limit}°C) on ${latest.deviceId ?? 'device'}`,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      }));
    if (messages.length > 0) await sendPush(messages);
    for (const { uid } of toAlert) state.lastAlert[uid] = now;
  }

  await fs.setState(state);
  console.log(`Reading ${temperature}°C checked, ${toAlert.length} alert(s)`);
}

async function sendPush(messages) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  console.log('Expo push:', res.status, await res.text());
}

// ---------- Firestore REST ----------

function firestore(projectId, accessToken) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  async function call(path, init = {}) {
    const res = await fetch(base + path, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async function listAll(collection) {
    const res = await call(`/${collection}?pageSize=300`);
    return (res?.documents ?? []).map((d) => ({ id: d.name.split('/').pop(), ...decodeFields(d.fields) }));
  }

  return {
    async latestReading() {
      const rows = await call(':runQuery', {
        method: 'POST',
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'readings' }],
            orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
            limit: 1,
          },
        }),
      });
      const doc = rows?.find((r) => r.document)?.document;
      return doc ? { id: doc.name.split('/').pop(), ...decodeFields(doc.fields) } : null;
    },

    async temperatureLimits() {
      const limits = {};
      for (const s of await listAll('settings')) limits[s.id] = Number(s.temperatureLimit ?? DEFAULT_LIMIT);
      // Users who never opened Settings still get the default limit.
      for (const u of await listAll('users')) limits[u.id] ??= DEFAULT_LIMIT;
      return limits;
    },

    async pushTokens() {
      const tokens = {};
      for (const u of await listAll('users')) if (u.pushToken) tokens[u.id] = u.pushToken;
      return tokens;
    },

    async getState() {
      const doc = await call('/watcher/state');
      return doc ? JSON.parse(doc.fields.data.stringValue) : null;
    },

    async setState(state) {
      await call('/watcher/state', {
        method: 'PATCH',
        body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(state) } } }),
      });
    },
  };
}

function decodeValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

// ---------- Google service-account auth ----------

let cachedToken = null; // reused while this Worker instance stays warm

async function getAccessToken(sa) {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const enc = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;

  const pem = sa.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64url(new Uint8Array(sig))}`,
    }),
  });
  if (!res.ok) throw new Error(`Google auth ${res.status}: ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  cachedToken = { value: access_token, expires: Date.now() + expires_in * 1000 };
  return access_token;
}

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
