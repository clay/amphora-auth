'use strict';

const { describe, it, beforeEach } = require('node:test'),
  assert = require('node:assert/strict'),
  storage = require('./storage');

describe('storage', () => {
  let calls;

  beforeEach(() => {
    calls = [];
    storage.setDb({
      get: (...args) => Promise.resolve(calls.push(['get', ...args]) && 'got'),
      put: (...args) => Promise.resolve(calls.push(['put', ...args]) && 'put'),
      del: (...args) => Promise.resolve(calls.push(['del', ...args]) && 'deleted'),
      list: (...args) => calls.push(['list', ...args]) && 'a stream'
    });
  });

  it('gets from the db it was given', async () => {
    assert.equal(await storage.get('/_users/a'), 'got');
    assert.deepEqual(calls, [['get', '/_users/a']]);
  });

  it('puts to it', async () => {
    assert.equal(await storage.put('/_users/a', '{}'), 'put');
    assert.deepEqual(calls, [['put', '/_users/a', '{}']]);
  });

  it('deletes from it', async () => {
    assert.equal(await storage.del('/_users/a'), 'deleted');
    assert.deepEqual(calls, [['del', '/_users/a']]);
  });

  it('lists from it, with options or without', () => {
    assert.equal(storage.list({ prefix: '/_users/' }), 'a stream');
    storage.list();
    assert.deepEqual(calls, [['list', { prefix: '/_users/' }], ['list', {}]]);
  });
});
