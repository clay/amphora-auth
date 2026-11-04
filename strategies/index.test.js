'use strict';

const { describe, it, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  passport = require('passport'),
  Module = require('module'),
  strategies = require('./index'),
  site = { slug: 'site', prefix: 'foo.com', protocol: 'http', port: 80, path: '/' },
  loaded = () => Object.keys(require.cache).filter(file => /node_modules\/(passport-[a-z0-9-]+|aws-sdk)\//.test(file)).map(file => file.match(/node_modules\/([^/]+)\//)[1]);

Object.assign(process.env, { GOOGLE_CONSUMER_KEY: 'gk', GOOGLE_CONSUMER_SECRET: 'gs' });

describe('strategies', () => {
  describe('createStrategy', () => {
    it('only loads the strategies that are used', () => {
      const use = mock.method(passport, 'use', () => {});

      strategies.createStrategy(['google'], site);
      assert.deepEqual(use.mock.calls.map(c => c.arguments[0]), ['apikey', 'google-site']);
      assert.ok(loaded().includes('passport-google-oauth'));
      assert.ok(loaded().includes('passport-http-header-token'));
      assert.ok(!loaded().includes('passport-ldapauth'));
      use.mock.restore();
    });

    it('always adds the apikey strategy, once', () => {
      const use = mock.method(passport, 'use', () => {});

      strategies.createStrategy(['apikey', 'local'], site);
      assert.deepEqual(use.mock.calls.map(c => c.arguments[0]), ['apikey', 'local-site']);
      use.mock.restore();
    });

    it('throws for a provider it does not know', () => {
      const use = mock.method(passport, 'use', () => {});

      assert.throws(() => strategies.createStrategy(['nope'], site), { message: 'Unknown provider: nope!' });
      assert.throws(() => strategies.createStrategy(['constructor'], site), { message: 'Unknown provider: constructor!' });
      use.mock.restore();
    });

    describe('ldap, which needs the optional passport-ldapauth package', () => {
      // runs createStrategy(['ldap']) as if requiring passport-ldapauth threw what the test says
      const withLdapPackage = (error, check) => {
        const file = require.resolve('./ldap'),
          cached = require.cache[file],
          original = Module._load,
          load = mock.method(Module, '_load', function (...args) {
            if (args[0] === 'passport-ldapauth') throw error;
            return original.apply(this, args);
          }),
          use = mock.method(passport, 'use', () => {});

        delete require.cache[file];
        try {
          check();
        } finally {
          load.mock.restore();
          use.mock.restore();
          if (cached) require.cache[file] = cached;
        }
      };

      it('says how to install it when it is not installed', () => {
        withLdapPackage(Object.assign(new Error("Cannot find module 'passport-ldapauth'"), { code: 'MODULE_NOT_FOUND' }), () => {
          assert.throws(() => strategies.createStrategy(['ldap'], site), {
            message: 'Provider ldap needs the passport-ldapauth package, which is not installed with amphora-auth. Run: npm install passport-ldapauth@^2.1.1'
          });
        });
      });

      it('does not hide any other error', () => {
        withLdapPackage(new Error('something else broke'), () => {
          assert.throws(() => strategies.createStrategy(['ldap'], site), { message: 'something else broke' });
        });
      });
    });

    it('says which providers were removed, and what is left', () => {
      const use = mock.method(passport, 'use', () => {});

      ['cognito', 'slack', 'twitter'].forEach(provider => {
        assert.throws(() => strategies.createStrategy([provider], site), {
          message: `Provider ${provider} was removed in amphora-auth 3. Use one of: apikey, google, ldap, local!`
        });
      });
      use.mock.restore();
    });
  });

  describe('addAuthRoutes', () => {
    it('adds the routes of the apikey strategy and of each provider', () => {
      const routes = [],
        authenticate = mock.method(passport, 'authenticate', () => 'authenticate'),
        router = { get: path => routes.push(['get', path]), post: path => routes.push(['post', path]) };

      strategies.addAuthRoutes(['apikey', 'local', 'google'], router, site);
      assert.deepEqual(routes, [
        ['get', '/_auth/apikey'], ['get', '/_auth/apikey/callback'],
        ['post', '/_auth/local'],
        ['get', '/_auth/google'], ['get', '/_auth/google/callback']
      ]);
      authenticate.mock.restore();
    });

    it('uses the addAuthRoutes of the strategy module when it is replaced, as sites does', () => {
      const google = require('./google'),
        original = google.addAuthRoutes,
        calls = [];

      google.addAuthRoutes = (...args) => calls.push(args);
      try {
        strategies.addAuthRoutes(['google'], { get() {} }, site);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].slice(1), [site, 'google']);
      } finally {
        google.addAuthRoutes = original;
      }
    });

    it('throws for a provider it does not know, or that was removed', () => {
      assert.throws(() => strategies.addAuthRoutes(['nope'], { get() {} }, site), { message: 'Unknown provider: nope!' });
      assert.throws(() => strategies.addAuthRoutes(['twitter'], { get() {} }, site), { message: /^Provider twitter was removed/ });
    });
  });
});
