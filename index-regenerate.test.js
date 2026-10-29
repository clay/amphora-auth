'use strict';

// CLAY_SESSION_REGENERATE=true: passport starts a new session when someone signs in or out

process.env.CLAY_SESSION_REGENERATE = 'true';

process.env.LOG = 'silent';

const { describe, it, mock } = require('node:test'),
  { EventEmitter } = require('events'),
  assert = require('node:assert/strict'),
  passport = require('passport'),
  lib = require('./index'),
  strategyService = require('./strategies');

describe('index with CLAY_SESSION_REGENERATE=true', () => {
  it('leaves the session to passport, which starts a new one at sign in', () => {
    const used = [],
      createStrategy = mock.method(strategyService, 'createStrategy', () => {}),
      addAuthRoutes = mock.method(strategyService, 'addAuthRoutes', () => {}),
      regenerate = () => {},
      req = { session: { regenerate }, headers: {} };

    lib({ router: { use: (...args) => used.push(args), get() {} }, providers: ['apikey'], store: new EventEmitter(), site: { slug: 's', prefix: 'a.com' }, storage: {}, bus: {} });
    used[1][0](req, {}, () => {});
    assert.equal(req.session.regenerate, regenerate);
    createStrategy.mock.restore();
    addAuthRoutes.mock.restore();
  });

  it('keeps what the old session held (where to go next) unless a route says otherwise', () => {
    const seen = [];

    passport.authenticate = function (...args) {
      seen.push(args);
      return () => {};
    };
    const createStrategy = mock.method(strategyService, 'createStrategy', () => {}),
      addAuthRoutes = mock.method(strategyService, 'addAuthRoutes', () => {});

    lib({ router: { use() {}, get() {} }, providers: ['apikey'], store: new EventEmitter(), site: { slug: 's', prefix: 'a.com' }, storage: {}, bus: {} });
    seen.length = 0; // passport.session() asks for the session strategy
    passport.authenticate('google', { successReturnToOrRedirect: '/' });
    passport.authenticate('google');
    passport.authenticate('google', { keepSessionInfo: false });
    passport.authenticate('google', () => {});
    assert.deepEqual(seen.map(args => args[1]).slice(0, 3), [{ keepSessionInfo: true, successReturnToOrRedirect: '/' }, { keepSessionInfo: true }, { keepSessionInfo: false }]);
    assert.equal(typeof seen[3][1], 'function');
    createStrategy.mock.restore();
    addAuthRoutes.mock.restore();
  });
});
