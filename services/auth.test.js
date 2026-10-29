'use strict';

const { describe, it } = require('node:test'),
  assert = require('node:assert/strict'),
  { createRes } = require('../test/helpers/mocks'),
  { withAuthLevel, checkAuthLevel, unauthorized } = require('./auth');

describe('auth', () => {
  describe('unauthorized', () => {
    it('answers 401 with a json message', () => {
      const res = createRes();

      unauthorized(res);
      assert.deepEqual(res.calls, [['status', 401], ['json', { code: 401, message: 'Unauthorized request' }]]);
    });
  });

  describe('checkAuthLevel', () => {
    it('throws if the user has no level', () => {
      assert.throws(() => checkAuthLevel(), { message: 'User does not have an authentication level set' });
      assert.throws(() => checkAuthLevel(''), { message: 'User does not have an authentication level set' });
      assert.throws(() => checkAuthLevel(null, 'write'), { message: 'User does not have an authentication level set' });
    });

    it('lets an admin do anything', () => {
      assert.equal(checkAuthLevel('admin'), true);
      assert.equal(checkAuthLevel('admin', 'write'), true);
    });

    it('lets a user do what is of their level', () => {
      assert.equal(checkAuthLevel('write', 'write'), true);
    });

    it('does not let a user do what is of another level', () => {
      assert.equal(checkAuthLevel('write', 'admin'), false);
      assert.equal(checkAuthLevel('ADMIN', 'admin'), false);
    });
  });

  describe('withAuthLevel', () => {
    it('goes on if the user has the level', () => {
      const calls = [],
        res = createRes();

      withAuthLevel('write')({ user: { auth: 'write' } }, res, () => calls.push('next'));
      withAuthLevel('write')({ user: { auth: 'admin' } }, res, () => calls.push('next'));
      assert.deepEqual(calls, ['next', 'next']);
      assert.deepEqual(res.calls, []);
    });

    it('answers 401 if the user lacks the level', () => {
      const calls = [],
        res = createRes();

      withAuthLevel('admin')({ user: { auth: 'write' } }, res, () => calls.push('next'));
      assert.deepEqual(calls, []);
      assert.deepEqual(res.calls, [['status', 401], ['json', { code: 401, message: 'Unauthorized request' }]]);
    });

    it('throws if there is no user, or the user has no level', () => {
      [undefined, {}, { user: null }, { user: {} }, { user: { auth: null } }, { user: { auth: 0 } }].forEach(req => {
        assert.throws(() => withAuthLevel('admin')(req, createRes(), () => {}), { message: 'User does not have an authentication level set' }, JSON.stringify(req));
      });
    });
  });
});
