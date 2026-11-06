'use strict';

process.env.LOG = 'silent';

const { describe, it, mock, afterEach } = require('node:test'),
  { EventEmitter } = require('events'),
  assert = require('node:assert/strict'),
  passport = require('passport'),
  { createRes } = require('./test/helpers/mocks'),
  lib = require('./index'),
  strategyService = require('./strategies'),
  site = { slug: 'site', prefix: 'domain.com', protocol: 'http', port: 80, path: '/' },
  logoutOf = calls => (...args) => {
    calls.push('logout');
    args.find(arg => typeof arg === 'function')();
  };

describe('index', () => {
  it('exports what amphora and the sites use', () => {
    assert.equal(typeof lib, 'function');
    assert.equal(lib.length, 1);
    assert.equal(typeof lib.withAuthLevel, 'function');
    assert.deepEqual(lib.authLevels, { ADMIN: 'admin', WRITE: 'write' });
    assert.equal(typeof lib.addRoutes, 'function');
    ['isProtectedRoute', 'isAuthenticated', 'protectRoutes', 'checkAuthentication', 'onLogin', 'onLogout', 'addUser'].forEach(name => assert.equal(typeof lib[name], 'function', name));
  });

  describe('isProtectedRoute', () => {
    it('is true in edit mode, and for anything that is not a GET or a HEAD', () => {
      assert.equal(lib.isProtectedRoute({ query: { edit: true } }), true);
      assert.equal(lib.isProtectedRoute({ query: { edit: 'true' }, method: 'GET' }), true);
      ['POST', 'PUT', 'DELETE', 'PATCH'].forEach(method => assert.equal(lib.isProtectedRoute({ query: {}, method }), true, method));
    });

    it('is false for a GET or a HEAD', () => {
      assert.equal(lib.isProtectedRoute({ query: {}, method: 'GET' }), false);
      assert.equal(lib.isProtectedRoute({ query: {}, method: 'HEAD' }), false);
    });

    it('is false for the auth routes, except in edit mode', () => {
      assert.equal(lib.isProtectedRoute({ query: {}, method: 'POST', originalUrl: '/_auth/local' }), false);
      assert.equal(lib.isProtectedRoute({ query: {}, method: 'POST', originalUrl: '/site/_auth/local' }), false);
      assert.equal(lib.isProtectedRoute({ query: { edit: '1' }, method: 'POST', originalUrl: '/_auth/local' }), true);
    });

    it('is false for /_auth anywhere in the path, as for a route that is named for the auth routes', () => {
      assert.equal(lib.isProtectedRoute({ query: {}, method: 'POST', originalUrl: '/hooks/_auth/notify' }), false);
      assert.equal(lib.isProtectedRoute({ query: {}, method: 'PUT', originalUrl: '/hooks/notify_auth/_auth-x?a=1' }), false);
    });

    it('does not open a route because of what is in the query string', () => {
      ['/open?x=/_auth', '/open?next=/_auth/local', '/open?a=1&b=/_auth/x', '/site/open?/_auth'].forEach(originalUrl => {
        assert.equal(lib.isProtectedRoute({ query: {}, method: 'POST', originalUrl }), true, originalUrl);
      });
    });
  });

  describe('isAuthenticated', () => {
    it('goes on if the user is signed in', () => {
      const calls = [];

      lib.isAuthenticated(site)({ isAuthenticated: () => true }, createRes(), () => calls.push('next'));
      assert.deepEqual(calls, ['next']);
    });

    it('tries the api key when there is an Authorization header', () => {
      const authenticate = mock.method(passport, 'authenticate', () => (req, res, next) => next()),
        calls = [];

      lib.isAuthenticated(site)({ isAuthenticated: () => false, get: header => header === 'Authorization' ? 'token x' : undefined }, createRes(), () => calls.push('next'));
      assert.deepEqual(authenticate.mock.calls[0].arguments, ['apikey', { session: false }]);
      assert.deepEqual(calls, ['next']);
      authenticate.mock.restore();
    });

    it('remembers where the user was going and sends them to the login page', () => {
      const req = { isAuthenticated: () => false, get: () => undefined, originalUrl: '/page?edit=true', session: {} },
        res = createRes();

      lib.isAuthenticated(site)(req, res, () => assert.fail('next'));
      assert.equal(req.session.returnTo, '/page?edit=true');
      assert.deepEqual(res.calls, [['redirect', 'http://domain.com/_auth/login']]);
    });

    it('sends the user to the login page when there is no session to remember where they were going in (the session store is down)', () => {
      const req = { isAuthenticated: () => false, get: () => undefined, originalUrl: '/page?edit=true' },
        res = createRes();

      lib.isAuthenticated(site)(req, res, () => assert.fail('next'));
      assert.deepEqual(res.calls, [['redirect', 'http://domain.com/_auth/login']]);
    });

    describe('with CLAY_AUTH_AUTO_LOGIN', () => {
      const providers = ['google', 'apikey'],
        opening = (extra = {}) => ({ isAuthenticated: () => false, get: () => undefined, originalUrl: '/page?edit=true', session: {}, method: 'GET', accepts: types => types[0], ...extra }),
        redirectOf = (req, withProviders = providers) => {
          const res = createRes();

          lib.isAuthenticated(site, withProviders)(req, res, () => assert.fail('next'));
          return res.calls[0][1];
        };

      afterEach(() => {
        delete process.env.CLAY_AUTH_AUTO_LOGIN;
      });

      it('sends someone who opens a page to the provider, remembering the page', () => {
        const req = opening();

        process.env.CLAY_AUTH_AUTO_LOGIN = 'google';
        assert.equal(redirectOf(req), 'http://domain.com/_auth/google');
        assert.equal(req.session.returnTo, '/page?edit=true');
      });

      it('sends everyone to the login page without it', () => {
        assert.equal(redirectOf(opening()), 'http://domain.com/_auth/login');
      });

      it('keeps the login page for a script that wants json, for anything but a GET, and when it can not tell', () => {
        process.env.CLAY_AUTH_AUTO_LOGIN = 'google';
        assert.equal(redirectOf(opening({ accepts: types => types[1] })), 'http://domain.com/_auth/login');
        ['POST', 'PUT', 'DELETE', 'HEAD'].forEach(method => assert.equal(redirectOf(opening({ method })), 'http://domain.com/_auth/login', method));
        assert.equal(redirectOf(opening({ accepts: undefined })), 'http://domain.com/_auth/login');
      });

      it('keeps the login page when there is no session (the session store is down), which says signing in is not available', () => {
        process.env.CLAY_AUTH_AUTO_LOGIN = 'google';
        assert.equal(redirectOf(opening({ session: undefined })), 'http://domain.com/_auth/login');
      });

      it('keeps the login page when the provider is not one the site has, or is not one to sign in with', () => {
        ['ldap', 'twitter', 'local', 'apikey', 'constructor'].forEach(name => {
          process.env.CLAY_AUTH_AUTO_LOGIN = name;
          assert.equal(redirectOf(opening()), 'http://domain.com/_auth/login', name);
        });
        process.env.CLAY_AUTH_AUTO_LOGIN = 'google';
        assert.equal(redirectOf(opening(), null), 'http://domain.com/_auth/login'); // providers not given
        assert.equal(redirectOf(opening(), ['local', 'apikey']), 'http://domain.com/_auth/login');
      });
    });
  });

  describe('protectRoutes', () => {
    it('checks protected routes, and lets the rest go by', () => {
      const calls = [],
        protectedRoute = { method: 'PUT', query: {}, isAuthenticated: () => true },
        publicRoute = { method: 'GET', query: {}, isAuthenticated: () => assert.fail('checked') };

      lib.protectRoutes(site)(protectedRoute, createRes(), () => calls.push('protected'));
      lib.protectRoutes(site)(publicRoute, createRes(), () => calls.push('public'));
      assert.deepEqual(calls, ['protected', 'public']);
    });

    it('never checks OPTIONS', () => {
      const calls = [];

      lib.protectRoutes(site)({ method: 'OPTIONS', query: { edit: true }, isAuthenticated: () => assert.fail('checked') }, createRes(), () => calls.push('next'));
      assert.deepEqual(calls, ['next']);
    });
  });

  describe('onLogin', () => {
    it('shows the login page, with the providers and the flash', () => {
      const res = createRes();

      lib.onLogin(site, ['google', 'local'])({ session: {}, flash: () => ({ error: ['Invalid Password'] }) }, res);
      assert.equal(res.calls[0][0], 'send');
      assert.match(res.calls[0][1], /Log in with Google/);
      assert.match(res.calls[0][1], /Invalid Password/);
      assert.match(res.calls[0][1], /id="username"/); // the form of the local provider
    });

    it('shows the login page, and says signing in is not available, when there is no session (the session store is down)', () => {
      const res = createRes();

      lib.onLogin(site, ['google'])({ flash: () => assert.fail('asked for the flash of a session that is not there') }, res);
      assert.equal(res.calls[0][0], 'send');
      assert.match(res.calls[0][1], /Log in with Google/);
      assert.match(res.calls[0][1], /Signing in is not available right now/);
    });

    it('shows who is signed in, and a way to log out', () => {
      const res = createRes();

      lib.onLogin(site, ['google'])({ session: {}, flash: () => ({}), user: { username: 'ann@example.com', name: 'Ann' } }, res);
      assert.match(res.calls[0][1], /Welcome, Ann/);
      assert.match(res.calls[0][1], /href="http:\/\/domain.com\/_auth\/logout"/);
    });

    it('asks for the credentials again when the ones sent were wrong', () => {
      const res = createRes();

      lib.onLogin(site, [])({ session: {}, flash: () => ({ error: ['Invalid username/password'] }) }, res);
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.calls, [['setHeader', 'WWW-Authenticate', 'Basic realm="Incorrect Credentials"'], ['end', 'Access denied']]);
    });
  });

  describe('onLogout', () => {
    it('logs the user out and goes to the login page', () => {
      const calls = [],
        res = createRes();

      lib.onLogout(site)({ user: { a: 1 }, logout: logoutOf(calls) }, res);
      assert.deepEqual(calls, ['logout']);
      assert.deepEqual(res.calls, [['redirect', 'http://domain.com/_auth/login']]);
    });

    it('logs out a session whose user is gone', () => {
      const calls = [];

      lib.onLogout(site)({ session: { passport: { user: 'x' } }, logout: logoutOf(calls) }, createRes());
      assert.deepEqual(calls, ['logout']);
    });

    it('does not log out someone who is not signed in (that would store a session)', () => {
      const calls = [],
        res = createRes();

      lib.onLogout(site)({ session: {}, logout: logoutOf(calls) }, res);
      assert.deepEqual(calls, []);
      assert.deepEqual(res.calls, [['redirect', 'http://domain.com/_auth/login']]);
    });

    it('goes to the login page even if logging out failed', () => {
      const res = createRes();

      lib.onLogout(site)({ user: {}, session: {}, logout: callback => callback(new Error('could not save')) }, res);
      assert.deepEqual(res.calls, [['redirect', 'http://domain.com/_auth/login']]);
    });
  });

  describe('checkAuthentication', () => {
    it('goes on if there is no error', () => {
      const calls = [];

      lib.checkAuthentication(site)(null, {}, createRes(), () => calls.push('next'));
      assert.deepEqual(calls, ['next']);
    });

    it('logs out and goes to the login page when there is an error (a user that was removed)', () => {
      const calls = [],
        res = createRes();

      lib.checkAuthentication(site)(new Error('gone'), { session: { passport: { user: 'x' } }, logout: logoutOf(calls) }, res, () => calls.push('next'));
      assert.deepEqual(calls, ['logout']);
      assert.deepEqual(res.calls, [['redirect', 'http://domain.com/_auth/login']]);
    });
  });

  describe('addUser', () => {
    it('puts the user in res.locals', () => {
      const res = createRes(),
        calls = [];

      lib.addUser({ user: { username: 'foo' } }, res, () => calls.push('next'));
      assert.deepEqual(res.locals.user, { username: 'foo' });
      assert.deepEqual(calls, ['next']);
    });
  });

  describe('init', () => {
    const store = new EventEmitter();

    it('does nothing without providers', () => {
      assert.deepEqual(lib({}), []);
      assert.deepEqual(lib({ providers: [] }), []);
    });

    it('adds the session, passport, flash and protection middleware, in that order, then the routes', () => {
      const createStrategy = mock.method(strategyService, 'createStrategy', () => {}),
        addAuthRoutes = mock.method(strategyService, 'addAuthRoutes', () => {}),
        used = [],
        got = [],
        router = { use: (...args) => used.push(args), get: (...args) => got.push(args) },
        providers = lib({ router, providers: ['apikey', 'google'], store, site, storage: {}, bus: {} });

      assert.equal(used.length, 7);
      assert.deepEqual(used.map(args => args.length), [1, 1, 1, 1, 1, 1, 1]);
      assert.deepEqual(got.map(args => args[0]), ['/_auth/login', '/_auth/logout']);
      assert.deepEqual(createStrategy.mock.calls[0].arguments, [['apikey', 'google'], site]);
      assert.equal(addAuthRoutes.mock.callCount(), 1);
      assert.deepEqual(providers.map(p => p.name), ['google']);
      createStrategy.mock.restore();
      addAuthRoutes.mock.restore();
    });
  });

  describe('passport middleware', () => {
    it('keeps the session id when someone signs in or out (it gets no new one)', () => {
      const req = { session: { regenerate: () => assert.fail('regenerated') }, headers: {} },
        used = [],
        createStrategy = mock.method(strategyService, 'createStrategy', () => {}),
        addAuthRoutes = mock.method(strategyService, 'addAuthRoutes', () => {});

      lib({ router: { use: (...args) => used.push(args), get() {} }, providers: ['apikey'], store: new EventEmitter(), site, storage: {}, bus: {} });
      const initialize = used[1][0];

      initialize(req, createRes(), () => {});
      let regenerated = false;

      req.session.regenerate(() => { regenerated = true; });
      assert.equal(regenerated, true);
      createStrategy.mock.restore();
      addAuthRoutes.mock.restore();
    });

    it('does not restore the user from a session that is not there (the session store is down)', () => {
      const used = [],
        createStrategy = mock.method(strategyService, 'createStrategy', () => {}),
        addAuthRoutes = mock.method(strategyService, 'addAuthRoutes', () => {}),
        calls = [];

      lib({ router: { use: (...args) => used.push(args), get() {} }, providers: ['apikey'], store: new EventEmitter(), site, storage: {}, bus: {} });
      used[2][0]({ headers: {} }, createRes(), error => calls.push(error));
      assert.deepEqual(calls, [undefined]);
      createStrategy.mock.restore();
      addAuthRoutes.mock.restore();
    });
  });
});
