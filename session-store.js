'use strict';

const session = require('express-session'),
  RedisStore = require('connect-redis')(session),
  { SECRET } = require('./constants'),
  { REDIS_DB, REDIS_SESSION_HOST } = process.env,
  sessionPrefix = REDIS_DB ? `${REDIS_DB}-clay-session:` : 'clay-session:';

/**
 * Creates a new session with Redis Store.
 * @returns {Object}
 */
function createSessionStore() {
  const store = new RedisStore({
    url: REDIS_SESSION_HOST,
    prefix: sessionPrefix
  });

  // because we're adding session handling to every site, our redis client needs
  // to have a higher max listener cap. we're setting it to 0 to disable the cap
  store.setMaxListeners(0);

  return session({
    secret: SECRET,
    resave: false, // please use a session store (like connect-redis) that supports .touch()
    saveUninitialized: false,
    rolling: true,
    name: 'clay-session',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    store,
  });
}

module.exports = createSessionStore;
