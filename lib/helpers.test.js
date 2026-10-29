'use strict';

const { describe, it } = require('node:test'),
  assert = require('node:assert/strict'),
  { get, isEmpty, capitalize, defaults, includes, omit } = require('./helpers');

// the expected values are what lodash 4 returns for the same input

describe('helpers', () => {
  describe('get', () => {
    const profile = { emails: [{ value: 'a@b.c' }], displayName: 'A', _json: { info: { user: { profile: { image_1024: 'img' } } } }, 'a.b': 'key with a dot', a: { b: 'nested' } };

    it('reads a path with dots and indexes', () => {
      assert.equal(get(profile, 'emails[0].value'), 'a@b.c');
      assert.equal(get(profile, '_json.info.user.profile.image_1024'), 'img');
      assert.equal(get(profile, 'displayName'), 'A');
    });

    it('prefers a key that is the whole path', () => {
      assert.equal(get(profile, 'a.b'), 'key with a dot');
    });

    it('reads quoted keys and arrays of keys', () => {
      assert.equal(get({ 'a.b': { c: 1 } }, '["a.b"].c'), 1);
      assert.equal(get(profile, ['a', 'b']), 'nested');
    });

    it('gives the default only for undefined', () => {
      assert.equal(get(profile, 'missing', 'dflt'), 'dflt');
      assert.equal(get(profile, 'emails[3].value', 'dflt'), 'dflt');
      assert.equal(get({ a: null }, 'a', 'dflt'), null);
      assert.equal(get({ a: 0 }, 'a', 'dflt'), 0);
      assert.equal(get({ a: '' }, 'a', 'dflt'), '');
    });

    it('copes with no object and with empty or missing paths', () => {
      assert.equal(get(undefined, 'a.b', 'dflt'), 'dflt');
      assert.equal(get(null, 'a'), undefined);
      assert.equal(get({ a: 1 }, '', 'dflt'), 'dflt');
      assert.equal(get({ '': 'empty' }, ''), 'empty');
      assert.equal(get({ a: 1 }, undefined, 'dflt'), 'dflt');
      assert.equal(get({ a: 1 }, [], 'dflt'), 'dflt');
    });
  });

  describe('isEmpty', () => {
    it('is true for nothing, empty collections and objects without own keys', () => {
      [undefined, null, '', [], {}, new Map(), new Set(), Buffer.alloc(0), 5, true, () => {}, Object.create({ inherited: 1 })]
        .forEach((value, i) => assert.equal(isEmpty(value), true, `value ${i}`));
    });

    it('is false for anything with something in it', () => {
      ['a', [1], [undefined], { a: undefined }, new Map([[1, 2]]), new Set([1]), Buffer.from('a'), { length: 2 }, Object.assign(Object.create(null), { a: 1 })]
        .forEach((value, i) => assert.equal(isEmpty(value), false, `value ${i}`));
    });

    it('treats an object with a length that is not an array as an object', () => {
      assert.equal(isEmpty({ length: 0 }), false);
      assert.equal(isEmpty({ length: 0, splice() {} }), true);
    });
  });

  describe('capitalize', () => {
    it('upper cases the first letter and lower cases the rest', () => {
      assert.equal(capitalize('google'), 'Google');
      assert.equal(capitalize('LDAP'), 'Ldap');
      assert.equal(capitalize('ÉCOLE'), 'École');
    });

    it('turns what is not a string into one', () => {
      assert.equal(capitalize(undefined), '');
      assert.equal(capitalize(null), '');
      assert.equal(capitalize(5), '5');
    });
  });

  describe('defaults', () => {
    it('fills in what is undefined, in place, and keeps the rest', () => {
      const data = { name: 'mine', imageUrl: undefined, extra: 1 },
        result = defaults(data, { name: 'theirs', imageUrl: 'img' });

      assert.equal(result, data);
      assert.deepEqual(data, { name: 'mine', imageUrl: 'img', extra: 1 });
    });

    it('keeps empty strings and null', () => {
      assert.deepEqual(defaults({ name: '', imageUrl: null }, { name: 'n', imageUrl: 'i' }), { name: '', imageUrl: null });
    });

    it('makes an object of what is not one', () => {
      assert.deepEqual(defaults(undefined, { a: 1 }), { a: 1 });
      assert.deepEqual(defaults(null, { a: 1 }), { a: 1 });
    });
  });

  describe('includes', () => {
    it('looks in arrays and strings', () => {
      assert.equal(includes(['GET', 'HEAD'], 'GET'), true);
      assert.equal(includes(['GET', 'HEAD'], 'POST'), false);
      assert.equal(includes('/x/_auth/login', '/_auth'), true);
      assert.equal(includes('/x/login', '/_auth'), false);
    });

    it('is false for anything else', () => {
      assert.equal(includes(undefined, 'a'), false);
      assert.equal(includes(null, 'a'), false);
      assert.equal(includes({ a: 'a' }, 'a'), false);
    });
  });

  describe('omit', () => {
    it('copies an object without some keys', () => {
      const data = { username: 'a', password: 'hash', auth: 'admin' },
        result = omit(data, ['password']);

      assert.deepEqual(result, { username: 'a', auth: 'admin' });
      assert.equal(data.password, 'hash');
      assert.notEqual(result, data);
    });

    it('gives an empty object for nothing', () => {
      assert.deepEqual(omit(undefined, ['password']), {});
      assert.deepEqual(omit(null, ['password']), {});
    });

    it('copes with what is not an object', () => {
      assert.deepEqual(omit('ab', ['password']), { 0: 'a', 1: 'b' });
      assert.deepEqual(omit(5, ['password']), {});
    });
  });
});
