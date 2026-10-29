'use strict';

const { describe, it, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  passport = require('passport'),
  { createRes } = require('../test/helpers/mocks'),
  utils = require('../utils'),
  ldap = require('./ldap'),
  site = { slug: 'site', prefix: 'foo.com', protocol: 'http', port: 80, path: '/' };

describe('ldap strategy', () => {
  it('registers a strategy that looks credentials up in the Basic header', () => {
    const use = mock.method(passport, 'use', () => {});

    Object.assign(process.env, { LDAP_URL: 'ldap://localhost:389', LDAP_BIND_DN: 'cn=x', LDAP_BIND_CREDENTIALS: 'pw', LDAP_SEARCH_BASE: 'dc=x', LDAP_SEARCH_FILTER: '(uid={{username}})' });
    ldap(site);
    assert.equal(use.mock.calls[0].arguments[0], 'ldap-site');
    const strategy = use.mock.calls[0].arguments[1];

    assert.equal(strategy.name, 'ldapauth');
    assert.deepEqual(strategy.options.credentialsLookup({ headers: { authorization: `Basic ${Buffer.from('user:pass').toString('base64')}` } }), { name: 'user', pass: 'pass' });
    use.mock.restore();
  });

  it('verifies with the sAMAccountName and displayName of the user', () => {
    const verify = mock.method(utils, 'verify', () => (...args) => args[4](null, args[3])),
      results = [];

    ldap.verifyLdap()({}, { sAMAccountName: 'ann', displayName: 'Ann' }, (...args) => results.push(args));
    assert.deepEqual(verify.mock.calls[0].arguments[0], { username: 'sAMAccountName', imageUrl: '', name: 'displayName', provider: 'ldap' });
    assert.deepEqual(results, [[null, { sAMAccountName: 'ann', displayName: 'Ann' }]]);
    verify.mock.restore();
  });

  it('asks for a username and password the browser can show, when there are none', () => {
    const res = createRes(),
      calls = [];

    ldap.checkCredentials({ headers: {} }, res, () => calls.push('next'));
    assert.deepEqual(calls, []);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.calls, [['setHeader', 'WWW-Authenticate', 'Basic'], ['end', 'Access denied']]);
  });

  it('goes on when there are credentials', () => {
    const calls = [];

    ldap.checkCredentials({ headers: { authorization: 'basic Zm9vOmJhcg==' } }, createRes(), () => calls.push('next'));
    assert.deepEqual(calls, ['next']);
  });

  it('adds a route that wants credentials, and goes back to the login page when they fail', () => {
    const routes = [],
      authenticate = mock.method(passport, 'authenticate', (...args) => args);

    ldap.addAuthRoutes({ get: (...args) => routes.push(args) }, site, 'ldap');
    assert.equal(routes[0][0], '/_auth/ldap');
    assert.equal(routes[0][1], ldap.checkCredentials);
    assert.deepEqual(routes[0][2], ['ldap-site', { failureRedirect: 'http://foo.com/_auth/login', failureFlash: true, successReturnToOrRedirect: '/' }]);
    authenticate.mock.restore();
  });
});
