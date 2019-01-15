'use strict';

const session = require('express-session'),
  RedisStore = require('connect-redis')(session),
  sessionPrefix = process.env.REDIS_DB ? `${process.env.REDIS_DB}-clay-session:` : 'clay-session:';

function createSessionStore() {
  const store = new RedisStore({
    url: process.env.REDIS_SESSION_HOST,
    prefix: sessionPrefix
  });

  // because we're adding session handling to every site, our redis client needs
  // to have a higher max listener cap. we're setting it to 0 to disable the cap
  store.setMaxListeners(0);

  console.log('store', store)

  return store;
}

module.exports = createSessionStore;
