'use strict';

const { describe, it, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  passport = require('passport'),
  bcrypt = require('bcryptjs'),
  { createStorage } = require('../test/helpers/mocks'),
  utils = require('../utils'),
  local = require('./local'),
  site = { slug: 'site', prefix: 'foo.com', protocol: 'http', port: 80, path: '/' };

describe('local strategy', () => {
  it('registers a strategy named for the site', () => {
    const use = mock.method(passport, 'use', () => {});

    local(site);
    local({ ...site, subsiteSlug: 'sub' });
    assert.deepEqual(use.mock.calls.map(c => c.arguments[0]), ['local-site', 'local-sub']);
    assert.equal(use.mock.calls[0].arguments[1].name, 'local');
    use.mock.restore();
  });

  it('checks the username and password against the stored user', async () => {
    const db = createStorage({ [`/_users/${utils.encode('bob', 'local')}`]: { username: 'bob', provider: 'local', auth: 'admin', password: bcrypt.hashSync('secret', 4) } });

    utils.setDb(db);
    const result = await new Promise(resolve => local.verifyLocal()({}, 'Bob', 'secret', (...args) => resolve(args))),
      wrong = await new Promise(resolve => local.verifyLocal()({}, 'bob', 'nope', (...args) => resolve(args)));

    assert.equal(result[1].username, 'bob');
    assert.deepEqual(wrong, [null, false, { message: 'Invalid Password' }]);
  });

  it('adds a post route that goes back to the login page when it fails', () => {
    const routes = [],
      authenticate = mock.method(passport, 'authenticate', (...args) => args);

    local.addAuthRoutes({ post: (...args) => routes.push(args) }, site, 'local');
    assert.deepEqual(routes, [['/_auth/local', ['local-site', { failureRedirect: 'http://foo.com/_auth/login', failureFlash: true, successReturnToOrRedirect: '/' }]]]);
    authenticate.mock.restore();
  });
});
