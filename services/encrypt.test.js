'use strict';

const { describe, it } = require('node:test'),
  assert = require('node:assert/strict'),
  { hashPassword, isValidPassword } = require('./encrypt'),
  // hashes of 'secret', made by bcryptjs 2.4.3 (what was stored before this package used bcryptjs 3)
  stored = {
    cost4: '$2a$04$ZvyKzz6rDfXPbq1rtLgIgeodWAWrfMS8w5xKBLSkNlMk4rBa5aZlO',
    cost10: '$2a$10$oLIcSx20PswGYfcIareE2OY4CMjmFgKv0j7Im4NDTJG/o4N1IC8EC'
  };

describe('encrypt', () => {
  describe('hashPassword', () => {
    it('makes a bcrypt hash with the $2a$ prefix and a cost of 10', () => {
      const hash = hashPassword('secret');

      assert.match(hash, /^\$2a\$10\$[./A-Za-z0-9]{53}$/);
    });

    it('makes a different hash every time, that all check out', () => {
      const a = hashPassword('secret'),
        b = hashPassword('secret');

      assert.notEqual(a, b);
      assert.equal(isValidPassword({ password: a }, 'secret'), true);
      assert.equal(isValidPassword({ password: b }, 'secret'), true);
    });

    it('throws for what is not a string', () => {
      assert.throws(() => hashPassword(), { message: /Illegal arguments/ });
    });

    it('hashes and checks a password that is a lone surrogate', () => {
      const start = Date.now(),
        hash = hashPassword('\ud83d');

      assert.equal(isValidPassword({ password: hash }, '\ud83d'), true);
      assert.ok(Date.now() - start < 2000);
    });
  });

  describe('isValidPassword', () => {
    it('checks the hashes that are already stored', () => {
      assert.equal(isValidPassword({ password: stored.cost4 }, 'secret'), true);
      assert.equal(isValidPassword({ password: stored.cost10 }, 'secret'), true);
      assert.equal(isValidPassword({ password: stored.cost10 }, 'Secret'), false);
      assert.equal(isValidPassword({ password: stored.cost10 }, ''), false);
    });

    it('checks the same hash under the other $2 prefixes', () => {
      ['$2a$', '$2b$', '$2y$'].forEach(prefix => {
        assert.equal(isValidPassword({ password: prefix + stored.cost4.slice(4) }, 'secret'), true, prefix);
      });
    });

    it('is false for something that is not a hash', () => {
      assert.equal(isValidPassword({ password: 'notahash' }, 'secret'), false);
      assert.equal(isValidPassword({ password: '' }, 'secret'), false);
    });

    it('throws if there is no hash', () => {
      assert.throws(() => isValidPassword({}, 'secret'), { message: /Illegal arguments/ });
    });
  });
});
