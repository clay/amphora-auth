'use strict';

// a redis that can't be reached: the store says so, and nothing throws

const { describe, it } = require('node:test'),
  assert = require('node:assert/strict');

process.env.REDIS_SESSION_HOST = 'redis://127.0.0.1:1';

const createSessionStore = require('./session-store');

describe('session-store without a redis', () => {
  it('emits disconnect, instead of throwing an unhandled error', async () => {
    createSessionStore();
    const store = createSessionStore.getRedisStore(),
      error = await new Promise(resolve => store.once('disconnect', resolve));

    assert.equal(error.code, 'ECONNREFUSED');
    createSessionStore.getRedisClient().disconnect();
  });
});
