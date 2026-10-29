'use strict';

let session = require('express-session'),
  redisStore; // the store made here, shared by every site that doesn't bring its own

const { isEmpty } = require('../lib/helpers'),
  { SECRET } = require('../constants'),
  { REDIS_DB, REDIS_SESSION_HOST } = process.env,
  sessionPrefix = REDIS_DB ? `${REDIS_DB}-clay-session:` : 'clay-session:';

/**
 * Creates the Redis store, connecting to REDIS_SESSION_HOST (a redis:// or rediss:// url, localhost when it isn't set).
 * Keys are `<prefix><session id>` holding the session as JSON, expiring with the session cookie.
 * @returns {Object}
 */
function createRedisStore() {
  const Redis = require('ioredis'),
    { RedisStore } = require('connect-redis'),
    client = new Redis(REDIS_SESSION_HOST),
    store = new RedisStore({ client, prefix: sessionPrefix });

  // express-session stops using a store that says it is disconnected (requests go on without a session)
  // and starts again when it says it is connected, so Redis going down doesn't hold requests up
  client.on('error', error => store.emit('disconnect', error));
  client.on('connect', () => store.emit('connect'));

  return store;
}

/**
 * Creates a new session with Redis Store.
 * @param {Object} store
 * @returns {Object}
 */
function createSessionStore(store = {}) {
  if (isEmpty(store) && !redisStore) {
    redisStore = createRedisStore();
  }

  const sessionStore = !isEmpty(store) ? store : redisStore;

  // because we're adding session handling to every site, our redis client needs
  // to have a higher max listener cap. we're setting it to 0 to disable the cap
  sessionStore.setMaxListeners(0);

  return session({
    secret: SECRET,
    resave: false, // please use a session store (like connect-redis) that supports .touch()
    saveUninitialized: false,
    rolling: true,
    name: 'clay-session',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: true
    },
    store: sessionStore,
  });
}

module.exports = createSessionStore;

// For testing purposes
module.exports.setSession = mock => session = mock;
module.exports.resetRedisStore = () => redisStore = undefined;
