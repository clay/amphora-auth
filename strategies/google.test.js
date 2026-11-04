'use strict';

// the Google strategy: a strategy per site and a route with its callback

const { describe, it, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  passport = require('passport'),
  google = require('./google'),
  site = { slug: 'site', prefix: 'foo.com', protocol: 'http', port: 80, path: '/' },
  callbackOptions = { failureRedirect: 'http://foo.com/_auth/login', failureFlash: true, successReturnToOrRedirect: '/' };

Object.assign(process.env, {
  GOOGLE_CONSUMER_KEY: 'gk', GOOGLE_CONSUMER_SECRET: 'gs', GOOGLE_PROFILE_URL: 'https://www.googleapis.com/oauth2/v3/userinfo'
});

describe('google strategy', () => {
  it('registers a strategy with the keys, the callback url and the profile url', () => {
    const use = mock.method(passport, 'use', () => {});

    google(site);
    const strategy = use.mock.calls[0].arguments[1];

    assert.equal(strategy.name, 'google');
    assert.equal(strategy._oauth2._clientId, 'gk');
    assert.equal(strategy._callbackURL, 'http://foo.com/_auth/google/callback');
    assert.equal(strategy._userProfileURL, 'https://www.googleapis.com/oauth2/v3/userinfo');
    use.mock.restore();
  });

  it('registers a strategy named for the site, or for the subsite', () => {
    const use = mock.method(passport, 'use', () => {});

    google(site);
    google({ ...site, subsiteSlug: 'sub' });
    assert.deepEqual(use.mock.calls.map(c => c.arguments[0]), ['google-site', 'google-sub']);
    use.mock.restore();
  });

  it('asks for the profile and the email', () => {
    const routes = [],
      authenticate = mock.method(passport, 'authenticate', (...args) => args);

    google.addAuthRoutes({ get: (...args) => routes.push(args) }, site, 'google');
    assert.deepEqual(routes[0][1][1].scope, ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']);
    assert.deepEqual(routes[1], ['/_auth/google/callback', ['google-site', callbackOptions]]);
    authenticate.mock.restore();
  });

  it('reads the user from the email, photo and display name of the profile', async () => {
    const use = mock.method(passport, 'use', () => {}),
      utils = require('../utils'),
      { createStorage } = require('../test/helpers/mocks');

    google(site);
    const strategy = use.mock.calls[0].arguments[1],
      uid = `/_users/${utils.encode('a@b.c', 'google')}`;

    utils.setDb(createStorage({ [uid]: { username: 'a@b.c', provider: 'google', auth: 'write' } }));
    const user = await new Promise((resolve, reject) => strategy._verify({}, 'token', 'refresh', { emails: [{ value: 'A@b.c' }], photos: [{ value: 'http://img' }], displayName: 'Ann' }, (e, u) => e ? reject(e) : resolve(u)));

    assert.deepEqual(user, { username: 'a@b.c', provider: 'google', auth: 'write', imageUrl: 'http://img', name: 'Ann' });
    use.mock.restore();
  });
});
