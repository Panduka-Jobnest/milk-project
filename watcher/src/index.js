// watcher/src/index.js
// Cloudflare Worker that runs every minute (cron). For every container it checks the latest
// reading in Firestore and sends an Expo push to each user whose temperature limit is exceeded
// or whose normal pH range is left.
// A reading's container is its "container" field, or its deviceId for older readings.
// Uses only the Firestore REST API, so Firebase can stay on the free Spark plan.

const COOLDOWN_MS = 10 * 60 * 1000; // at most one alert per user, container and check type every 10 minutes
const LOOKBACK_MS = 10 * 60 * 1000; // containers that sent nothing in this window are skipped
// Same defaults as the app (constants/Thresholds.ts)
const DEFAULT_LIMIT = 50;
const DEFAULT_PH_MIN = 6.4;
const DEFAULT_PH_MAX = 6.8;

export default {
  async scheduled(event, env, ctx) {
    await checkReadings(env);
  },
};

async function checkReadings(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const fs = firestore(sa.project_id, await getAccessToken(sa));

  const latestByContainer = await fs.latestReadingPerContainer(new Date(Date.now() - LOOKBACK_MS).toISOString());
  if (latestByContainer.size === 0) return console.log('No recent readings');

  // state = { lastReading: { container: <timestamp of last processed reading> },
  //           lastAlert: { "uid:container:temp" | "uid:container:ph": ms } }
  let state = (await fs.getState()) ?? {};
  if (typeof state.lastReading !== 'object' || state.lastReading === null) {
    state = { lastReading: {}, lastAlert: {} }; // older single-device state format
  }

  const users = await fs.userConfigs();
  if (Object.keys(users).length === 0) console.log('No users found in Firestore "users"/"settings"');
  const now = Date.now();
  const toAlert = new Map(); // uid -> [{ container, deviceId, issues }]

  for (const [container, reading] of latestByContainer) {
    const deviceId = reading.deviceId ?? 'unknown';
    const readingKey = JSON.stringify(reading.timestamp ?? reading.id);
    if (state.lastReading[container] === readingKey) {
      console.log(`${container}: no new reading`);
      continue;
    }
    state.lastReading[container] = readingKey;

    const temperature = Number(reading.temperature);
    const ph = reading.ph == null ? null : Number(reading.ph); // older devices may not send pH

    for (const [uid, u] of Object.entries(users)) {
      const issues = [];

      const tempKey = `${uid}:${container}:temp`;
      if (!(temperature > u.limit)) {
        delete state.lastAlert[tempKey]; // back to normal: alert straight away next time
      } else if (now - (state.lastAlert[tempKey] ?? 0) > COOLDOWN_MS) {
        issues.push({ kind: 'temp', text: `Temperature is ${temperature.toFixed(1)}°C (limit ${u.limit}°C)` });
      } else {
        console.log(`${uid}/${container}: over limit ${u.limit}°C, cooldown`);
      }

      const phKey = `${uid}:${container}:ph`;
      if (ph === null || Number.isNaN(ph)) {
        // no pH in this reading, nothing to check
      } else if (ph >= u.phMin && ph <= u.phMax) {
        delete state.lastAlert[phKey];
      } else if (now - (state.lastAlert[phKey] ?? 0) > COOLDOWN_MS) {
        const why = ph < u.phMin ? `too acidic, below ${u.phMin}` : `too alkaline, above ${u.phMax}`;
        issues.push({ kind: 'ph', text: `pH is ${ph.toFixed(2)} (${why})` });
      } else {
        console.log(`${uid}/${container}: pH ${ph} out of range, cooldown`);
      }

      if (issues.length > 0) {
        if (!toAlert.has(uid)) toAlert.set(uid, []);
        toAlert.get(uid).push({ container, deviceId, issues });
      }
    }
    console.log(`${container}: ${temperature}°C, pH ${ph ?? '—'} checked`);
  }

  if (toAlert.size > 0) {
    const tokens = await fs.pushTokens();
    const messages = [];
    for (const [uid, alerts] of toAlert) {
      if (!tokens[uid]) {
        console.log(`${uid}: no pushToken saved, skipped`);
        continue;
      }
      for (const { container, deviceId, issues } of alerts) {
        messages.push({
          to: tokens[uid],
          title: `${alertTitle(issues)} · ${container}`,
          body: `${issues.map((i) => i.text).join('\n')}\n${container === deviceId ? container : `${container} (${deviceId})`}`,
          sound: 'default',
          channelId: 'default',
          priority: 'high',
        });
      }
    }
    if (messages.length > 0) await sendPush(messages);
    for (const [uid, alerts] of toAlert) {
      for (const { container, issues } of alerts) {
        for (const { kind } of issues) state.lastAlert[`${uid}:${container}:${kind}`] = now;
      }
    }
  }

  await fs.setState(state);
  console.log(`${latestByContainer.size} container(s) checked, ${[...toAlert.values()].flat().length} alert(s)`);
}

function alertTitle(issues) {
  if (issues.length > 1) return '🚨 Milk quality alert';
  return issues[0].kind === 'ph' ? '🧪 Milk pH alert' : '🚨 Milk temperature alert';
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
    // Newest reading of each container that reported since `sinceIso`
    async latestReadingPerContainer(sinceIso) {
      const rows = await call(':runQuery', {
        method: 'POST',
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'readings' }],
            where: {
              fieldFilter: { field: { fieldPath: 'timestamp' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: sinceIso } },
            },
            orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
            limit: 1000,
          },
        }),
      });
      const latest = new Map();
      for (const r of rows ?? []) {
        if (!r.document) continue;
        const doc = { id: r.document.name.split('/').pop(), ...decodeFields(r.document.fields) };
        const container = doc.container || doc.deviceId || 'unknown';
        if (!latest.has(container)) latest.set(container, doc); // rows are newest first
      }
      return latest;
    },

    // Per user: thresholds (settings/{uid})
    async userConfigs() {
      const all = {};
      for (const s of await listAll('settings')) {
        all[s.id] = {
          limit: Number(s.temperatureLimit ?? DEFAULT_LIMIT),
          phMin: Number(s.phMin ?? DEFAULT_PH_MIN),
          phMax: Number(s.phMax ?? DEFAULT_PH_MAX),
        };
      }
      // Users who never opened Settings still get the defaults.
      for (const u of await listAll('users')) {
        all[u.id] ??= { limit: DEFAULT_LIMIT, phMin: DEFAULT_PH_MIN, phMax: DEFAULT_PH_MAX };
      }
      return all;
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
