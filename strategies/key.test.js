'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  passport = require('passport'),
  key = require('./key'),
  call = apikey => new Promise(resolve => key.apiCallback(apikey, (...args) => resolve(args)));

describe('key strategy', () => {
  const original = process.env.CLAY_ACCESS_KEY;

  beforeEach(() => {
    process.env.CLAY_ACCESS_KEY = '123';
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CLAY_ACCESS_KEY;
    } else {
      process.env.CLAY_ACCESS_KEY = original;
    }
  });

  describe('apiCallback', () => {
    it('lets in the key that is CLAY_ACCESS_KEY, as an admin', async () => {
      assert.deepEqual(await call('123'), [null, { provider: 'apikey', auth: 'admin' }]);
    });

    it('does not let in another key', async () => {
      ['456', '1234', '12', '', '123 ', 'x'.repeat(5000)].forEach(async apikey => {
        const [error, user, info] = await call(apikey);

        assert.equal(error, null);
        assert.equal(user, false);
        assert.equal(info.message, `Unknown apikey: ${apikey}`);
      });
    });

    it('does not let in anything that is not a string', async () => {
      for (const apikey of [undefined, null, 123, ['123'], { toString: () => '123' }]) {
        assert.equal((await call(apikey))[1], false);
      }
    });

    it('lets in nobody when there is no CLAY_ACCESS_KEY', async () => {
      delete process.env.CLAY_ACCESS_KEY;
      assert.equal((await call(undefined))[1], false);
      assert.equal((await call('undefined'))[1], false);
    });
  });

  describe('createAPIKeyStrategy', () => {
    it('registers the apikey strategy with passport', () => {
      const use = mock.method(passport, 'use', () => {});

      key();
      assert.equal(use.mock.callCount(), 1);
      assert.equal(use.mock.calls[0].arguments[0], 'apikey');
      assert.equal(use.mock.calls[0].arguments[1].name, 'http-header-token');
      use.mock.restore();
    });
  });

  describe('addAuthRoutes', () => {
    it('adds the route and its callback', () => {
      const routes = [],
        authenticate = mock.method(passport, 'authenticate', (...args) => args),
        router = { get: (...args) => routes.push(args) };

      key.addAuthRoutes(router, { slug: 'site', prefix: 'foo.com', protocol: 'http', port: 80, path: '/' }, 'apikey');
      assert.deepEqual(routes[0], ['/_auth/apikey', ['apikey-site']]);
      assert.deepEqual(routes[1], ['/_auth/apikey/callback', ['apikey-site', { failureRedirect: 'http://foo.com/_auth/login', failureFlash: true, successReturnToOrRedirect: '/' }]]);
      authenticate.mock.restore();
    });
  });
});
