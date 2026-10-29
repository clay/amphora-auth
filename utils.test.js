'use strict';

const { describe, it, beforeEach, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  bcrypt = require('bcryptjs'),
  handlebars = require('handlebars'),
  { createStorage } = require('./test/helpers/mocks'),
  utils = require('./utils'),
  hash = bcrypt.hashSync('secret', 4),
  site = { prefix: 'foo.com', protocol: 'http', port: 80 };

describe('utils', () => {
  describe('encode', () => {
    it('makes base64 of the username and the provider', () => {
      assert.equal(utils.encode('foo', 'bar'), Buffer.from('foo@bar', 'utf8').toString('base64'));
      assert.equal(utils.encode('jörg', 'local'), 'asO2cmdAbG9jYWw=');
    });
  });

  describe('getAuthUrl', () => {
    it('puts _auth after the url, with or without a slash at the end of it', () => {
      assert.equal(utils.getAuthUrl({ ...site, prefix: 'foo.com' }), 'http://foo.com/_auth');
      assert.equal(utils.getAuthUrl({ ...site, prefix: 'foo.com/' }), 'http://foo.com/_auth');
      assert.equal(utils.getAuthUrl({ ...site, prefix: 'foo.com/sub' }), 'http://foo.com/sub/_auth');
      assert.equal(utils.getAuthUrl({ ...site, prefix: 'foo.com/sub/' }), 'http://foo.com/sub/_auth');
    });

    it('says the protocol and a port that is not the default', () => {
      assert.equal(utils.getAuthUrl({ prefix: 'foo.com', protocol: 'https', port: 3000 }), 'https://foo.com:3000/_auth');
    });
  });

  describe('getCallbackUrl', () => {
    it('is the auth url of the provider, then callback', () => {
      assert.equal(utils.getCallbackUrl({ ...site, prefix: 'domain.com/foo' }, 'twitter'), 'http://domain.com/foo/_auth/twitter/callback');
      assert.equal(utils.getCallbackUrl({ ...site, prefix: 'domain.com/' }, 'twitter'), 'http://domain.com/_auth/twitter/callback');
    });
  });

  describe('getPathOrBase', () => {
    it('is the path of the site, or a slash', () => {
      assert.equal(utils.getPathOrBase(), '/');
      assert.equal(utils.getPathOrBase({}), '/');
      assert.equal(utils.getPathOrBase({ path: '' }), '/');
      assert.equal(utils.getPathOrBase({ path: '/foo' }), '/foo');
    });
  });

  describe('generateStrategyName', () => {
    it('is the provider and the slug, of the subsite when there is one', () => {
      assert.equal(utils.generateStrategyName('twitter', { slug: 'nymag' }), 'twitter-nymag');
      assert.equal(utils.generateStrategyName('twitter', { slug: 'nymag', subsiteSlug: 'sub' }), 'twitter-sub');
    });
  });

  describe('getProviders', () => {
    it('describes the providers that are not apikey or local', () => {
      const providers = utils.getProviders(['apikey', 'local', 'google', 'ldap'], site);

      assert.deepEqual(providers.map(({ name, url, title }) => ({ name, url, title })), [
        { name: 'google', url: 'http://foo.com/_auth/google', title: 'Log in with Google' },
        { name: 'ldap', url: 'http://foo.com/_auth/ldap', title: 'Log in with Ldap' }
      ]);
      assert.deepEqual(providers.map(p => p.icon()), ['google', 'ldap']);
    });

    it('gives none for none', () => {
      assert.deepEqual(utils.getProviders([], site), []);
      assert.deepEqual(utils.getProviders(undefined, site), []);
    });
  });

  describe('removePrefix', () => {
    it('removes the token and what is before it', () => {
      assert.equal(utils.removePrefix('foo/bar', '/'), 'bar');
      assert.equal(utils.removePrefix('Client: the message ', ':'), 'the message');
    });

    it('leaves the string alone without the token', () => {
      assert.equal(utils.removePrefix('foo-bar', '/'), 'foo-bar');
    });
  });

  describe('removeQueryString and removeExtension', () => {
    it('remove the query string', () => {
      assert.equal(utils.removeQueryString('http://nymag.com?edit=true'), 'http://nymag.com');
      assert.equal(utils.removeQueryString('http://nymag.com'), 'http://nymag.com');
    });

    it('remove the extension of the last part', () => {
      assert.equal(utils.removeExtension('http://nymag.com/_pages/homepage.html'), 'http://nymag.com/_pages/homepage');
      assert.equal(utils.removeExtension('http://nymag.com/_pages/homepage'), 'http://nymag.com/_pages/homepage');
      assert.equal(utils.removeExtension('homepage.html'), 'homepage');
      assert.equal(utils.removeExtension('a.b/c'), 'a.b/c');
    });
  });

  describe('getUri', () => {
    it('is the host and the path, without the extension or the query', () => {
      assert.equal(utils.getUri({ hostname: 'foo.com', baseUrl: '/bar', path: '/pizza' }), 'foo.com/bar/pizza');
      assert.equal(utils.getUri({ hostname: 'foo.com', baseUrl: '', path: '/_pages/a.html?edit=true' }), 'foo.com/_pages/a');
    });
  });

  describe('compileTemplate', () => {
    it('compiles a file of the views folder', () => {
      assert.equal(utils.compileTemplate('google.svg')({}).includes('<svg'), true);
    });

    it('compiles with handlebars', () => {
      const compile = mock.method(handlebars, 'compile');

      utils.compileTemplate('google.svg');
      assert.equal(compile.mock.callCount(), 1);
      compile.mock.restore();
    });
  });

  describe('serializeUser and deserializeUser', () => {
    let db;

    beforeEach(() => {
      db = createStorage({ '/_users/Zm9vQGdvb2dsZQ==': { username: 'foo', provider: 'google', auth: 'write' } });
      utils.setDb(db);
    });

    it('serializes to the encoded, lower cased username and provider', () => {
      let result;

      utils.serializeUser({ username: 'Foo', provider: 'google' }, (...args) => { result = args; });
      assert.deepEqual(result, [null, 'Zm9vQGdvb2dsZQ==']);
    });

    it('deserializes by reading the user', async () => {
      let result;

      await utils.deserializeUser('Zm9vQGdvb2dsZQ==', (...args) => { result = args; });
      assert.deepEqual(result, [null, { username: 'foo', provider: 'google', auth: 'write' }]);
    });

    it('passes on the error when the user is gone', async () => {
      let result;

      await utils.deserializeUser('bm9ib2R5', (...args) => { result = args; });
      assert.equal(result[0].message, 'not found');
    });
  });

  describe('verify', () => {
    const profile = { username: 'foo@example.com' },
      properties = { username: 'username', provider: 'google' },
      uid = `/_users/${utils.encode('foo@example.com', 'google')}`,
      run = (props, prof, req = {}) => new Promise(resolve => {
        utils.verify(props)(req, null, null, prof, (...args) => resolve(args));
      });
    let db;

    beforeEach(() => {
      db = createStorage({ [uid]: { username: 'foo@example.com', provider: 'google', auth: 'admin' } });
      utils.setDb(db);
    });

    it('throws if the profile has no username', () => {
      assert.throws(() => utils.verify(properties)({}, '', '', { username: '' }, () => {}), { message: 'Provider hasn\'t given a username at username' });
    });

    it('finds the user by the lower cased username', async () => {
      const [error, user] = await run(properties, { username: 'Foo@Example.com' });

      assert.equal(error, null);
      assert.equal(user.auth, 'admin');
    });

    it('takes the username, name and image from the paths it is given', async () => {
      const [, user] = await run({ username: 'emails[0].value', imageUrl: 'photos[0].value', name: 'displayName', provider: 'google' },
        { emails: [{ value: 'foo@example.com' }], photos: [{ value: 'http://img' }], displayName: 'Foo' });

      assert.equal(user.name, 'Foo');
      assert.equal(user.imageUrl, 'http://img');
    });

    it('saves the name and image the first time, but keeps ones that are already there', async () => {
      await run({ ...properties, name: 'displayName' }, { ...profile, displayName: 'From Google' });
      assert.equal(JSON.parse(db.data.get(uid)).name, 'From Google');
      await run({ ...properties, name: 'displayName' }, { ...profile, displayName: 'Changed' });
      assert.equal(JSON.parse(db.data.get(uid)).name, 'From Google');
    });

    it('says the user was not found', async () => {
      assert.deepEqual(await run(properties, { username: 'nobody@example.com' }), [null, false, { message: 'User not found!' }]);
      assert.deepEqual(await run(properties, { username: 'nobody@example.com' }, { user: { a: 1 } }), [null, false, { message: 'User not found!' }]);
    });

    it('passes on the error if the user could not be saved', async () => {
      db.put = () => Promise.reject(new Error('Something went wrong'));
      const [error] = await run(properties, profile);

      assert.equal(error.message, 'Something went wrong');
    });

    it('checks the password against the hash of the user', async () => {
      const props = { username: 'username', password: 'password', provider: 'local' },
        localUid = `/_users/${utils.encode('bob', 'local')}`;

      db.data.set(localUid, JSON.stringify({ username: 'bob', provider: 'local', auth: 'admin', password: hash }));
      assert.equal((await run(props, { username: 'bob', password: 'secret' }))[1].auth, 'admin');
      assert.deepEqual(await run(props, { username: 'bob', password: 'wrong' }), [null, false, { message: 'Invalid Password' }]);
      // already signed in
      assert.equal((await run(props, { username: 'bob', password: 'secret' }, { user: {} }))[1].auth, 'admin');
      assert.deepEqual(await run(props, { username: 'bob', password: 'wrong' }, { user: {} }), [null, false, { message: 'Invalid Password' }]);
    });

    it('does not ask for a password where there is none to check', async () => {
      assert.equal((await run(properties, profile))[1].username, 'foo@example.com');
    });
  });
});
