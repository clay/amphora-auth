'use strict';

const { describe, it, beforeEach } = require('node:test'),
  assert = require('node:assert/strict'),
  bcrypt = require('bcryptjs'),
  { createStorage } = require('../test/helpers/mocks'),
  { encode } = require('../utils'),
  users = require('./users');

describe('users controller', () => {
  let db, published;

  beforeEach(() => {
    db = createStorage();
    published = [];
    users.setDb(db);
    users.setBus({ publish: (...args) => published.push(args) });
  });

  describe('createUser', () => {
    it('throws if the user lacks a username, provider or auth level', () => {
      [undefined, {}, { username: 'a' }, { username: 'a', provider: 'p' }, { provider: 'p', auth: 'a' }].forEach(data => {
        assert.throws(() => users.createUser(data), { message: 'Users require username, provider and auth to be specified!' });
      });
    });

    it('saves the user under the encoded, lower cased username and provider, and tells the bus', async () => {
      const uri = `/_users/${encode('bob', 'google')}`,
        user = await users.createUser({ username: 'Bob', provider: 'google', auth: 'write' });

      assert.equal(user._ref, uri);
      assert.deepEqual(JSON.parse(db.data.get(uri)), { username: 'Bob', provider: 'google', auth: 'write' });
      assert.deepEqual(published, [['saveUser', { key: uri, value: user }]]);
    });

    it('hashes the password with bcrypt', async () => {
      const user = await users.createUser({ username: 'bob', password: 'secret', provider: 'local', auth: 'admin' }),
        stored = JSON.parse(db.data.get(user._ref));

      assert.notEqual(stored.password, 'secret');
      assert.equal(bcrypt.compareSync('secret', stored.password), true);
    });

    it('does not tell the bus if the user could not be saved', async () => {
      db.put = () => Promise.reject(new Error('db down'));
      await assert.rejects(users.createUser({ username: 'a', provider: 'p', auth: 'a' }), { message: 'db down' });
      assert.deepEqual(published, []);
    });
  });

  describe('deleteUser', () => {
    it('deletes the user, tells the bus and gives the user back', async () => {
      db.data.set('/_users/a', JSON.stringify({ username: 'a' }));
      assert.deepEqual(await users.deleteUser('/_users/a'), { username: 'a' });
      assert.equal(db.data.has('/_users/a'), false);
      assert.deepEqual(published, [['deleteUser', { uri: '/_users/a' }]]);
    });

    it('deletes nothing that is not there', async () => {
      await assert.rejects(users.deleteUser('/_users/nope'), { message: 'not found' });
      await assert.rejects(users.deleteUser(), { message: 'not found' });
      assert.deepEqual(published, []);
    });
  });
});
