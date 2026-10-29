'use strict';

const { describe, it, before, after } = require('node:test'),
  assert = require('node:assert/strict'),
  { EventEmitter } = require('events'),
  { start } = require('../test/helpers/resp-server');

describe('session-store', () => {
  let redis, createSessionStore;

  before(async () => {
    redis = await start();
    process.env.REDIS_SESSION_HOST = `${redis.url}/2`;
    process.env.REDIS_DB = 'cool-db-name';
    createSessionStore = require('./session-store');
  });

  after(async () => {
    await redis.close();
    createSessionStore.getRedisClient().disconnect();
  });

  describe('with a store that is passed in', () => {
    it('uses it, and lifts the limit of listeners on it', () => {
      const store = new EventEmitter();

      store.setMaxListeners(10);
      assert.equal(typeof createSessionStore(store), 'function');
      assert.equal(store.getMaxListeners(), 0);
      assert.equal(createSessionStore.getRedisStore(), undefined); // nothing was made, nothing connected
      assert.equal(redis.connections(), 0);
    });

    it('gives a session middleware', () => {
      const middleware = createSessionStore(new EventEmitter()),
        req = { headers: {}, get: () => undefined };

      assert.equal(middleware.length, 3);
      assert.ok(req);
    });
  });

  describe('without one', () => {
    it('makes a redis store from REDIS_SESSION_HOST, with the prefix from REDIS_DB', async () => {
      createSessionStore();
      const store = createSessionStore.getRedisStore();

      assert.equal(store.prefix, 'cool-db-name-clay-session:');
      await new Promise((resolve, reject) => store.set('abc', { cookie: { originalMaxAge: 60000, expires: new Date(Date.now() + 60000).toISOString() }, passport: { user: 'x' } }, e => e ? reject(e) : resolve()));
      const stored = await new Promise((resolve, reject) => store.get('abc', (e, s) => e ? reject(e) : resolve(s)));

      assert.equal(stored.passport.user, 'x');
      assert.deepEqual(redis.log.filter(c => c[0] === 'SELECT'), [['SELECT', '2']]);
      const set = redis.log.find(c => c[0] === 'SET');

      assert.equal(set[1], 'cool-db-name-clay-session:abc');
      assert.deepEqual(JSON.parse(set[2]).passport, { user: 'x' });
      assert.deepEqual(set.slice(3), ['EX', '60']);
    });

    it('expires a session with its cookie, touches it and destroys it', async () => {
      const store = createSessionStore.getRedisStore(),
        sess = { cookie: { maxAge: 3600000, originalMaxAge: 3600000, expires: new Date(Date.now() + 3600000).toISOString() } };

      await new Promise(resolve => store.touch('abc', sess, resolve));
      assert.deepEqual(redis.log.filter(c => c[0] === 'EXPIRE').pop().slice(0, 2), ['EXPIRE', 'cool-db-name-clay-session:abc']);
      assert.ok(Math.abs(Number(redis.log.filter(c => c[0] === 'EXPIRE').pop()[2]) - 3600) <= 1);
      await new Promise(resolve => store.destroy('abc', resolve));
      assert.deepEqual(redis.log.filter(c => c[0] === 'DEL').pop(), ['DEL', 'cool-db-name-clay-session:abc']);
    });

    it('makes the store once for every site, with one connection', () => {
      const first = createSessionStore.getRedisStore();

      createSessionStore();
      createSessionStore();
      assert.equal(createSessionStore.getRedisStore(), first);
      assert.equal(redis.connections(), 1);
      assert.equal(first.getMaxListeners(), 0);
    });

    it('tells express-session when redis goes away and comes back', () => {
      const store = createSessionStore.getRedisStore(),
        events = [];

      store.on('disconnect', () => events.push('disconnect'));
      store.on('connect', () => events.push('connect'));
      createSessionStore.getRedisClient().emit('error', new Error('connection lost'));
      createSessionStore.getRedisClient().emit('connect');
      assert.deepEqual(events, ['disconnect', 'connect']);
    });
  });
});
