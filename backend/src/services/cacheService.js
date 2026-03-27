const Redis = require('ioredis');

let client = null;

function getClient() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    client.on('error', (err) => console.warn('[Redis] Erreur:', err.message));
  }
  return client;
}

module.exports = {
  async get(key) {
    try { return await getClient().get(key); }
    catch { return null; }
  },
  async set(key, value, ttlSeconds = 300) {
    try { await getClient().setex(key, ttlSeconds, value); }
    catch { /* Redis indisponible — on continue sans cache */ }
  },
  async del(key) {
    try { await getClient().del(key); }
    catch {}
  },
  async delPattern(pattern) {
    try {
      const client = getClient();
      const keys = await client.keys(pattern);
      if (keys.length) await client.del(...keys);
    } catch {}
  },
};
