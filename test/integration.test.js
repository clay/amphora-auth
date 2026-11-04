'use strict';

// the package in an express app, over http: sign in with a password, with an api key and with google (the calls
// to google are answered by the test), the users routes, and what happens when the session store goes down

process.env.CLAY_ACCESS_KEY = 'test-key';
process.env.CLAY_SESSION_SECRET = 'test-secret';
process.env.LOG = 'silent';
Object.assign(process.env, { GOOGLE_CONSUMER_KEY: 'google-key', GOOGLE_CONSUMER_SECRET: 'google-secret', GOOGLE_PROFILE_URL: 'https://www.googleapis.com/oauth2/v3/userinfo' });
delete process.env.PORT;

const { describe, it, after } = require('node:test'),
  assert = require('node:assert/strict'),
  { build, encode, hash } = require('./helpers/app'),
  bcrypt = require('bcryptjs'),
  key = { authorization: 'token test-key' },
  login = { username: 'bob', password: 'secret' },
  loginPage = 'http://localhost:3000/_auth/login',
  apps = [],
  make = async options => {
    const app = await build(options);

    apps.push(app);
    return app;
  };

after(() => Promise.all(apps.map(app => app.close())));

describe('integration', () => {
  describe('signing in with a password', () => {
    it('lets anyone read a public page, and keeps no session for them', async () => {
      const app = await make();
      const page = await app.request('GET', '/page');

      assert.deepEqual([page.status, page.body, page.cookies], [200, { user: null, auth: null }, []]);
      assert.equal(app.store.sessions.size, 0);
    });

    it('sends someone who is not signed in to the login page, and remembers where they were going', async () => {
      const app = await make(),
        edit = await app.request('GET', '/page?edit=true');

      assert.deepEqual([edit.status, edit.location], [302, loginPage]);
      assert.deepEqual(app.store.dump(), [{ cookie: { originalMaxAge: 604800000, secure: true, httpOnly: true, path: '/' }, returnTo: '/page?edit=true' }]);
      assert.match(edit.cookies[0], /^clay-session=[^;]+; Path=\/; Expires=[^;]+; HttpOnly; Secure$/);
    });

    it('shows the login page', async () => {
      const app = await make(),
        page = await app.request('GET', '/_auth/login');

      assert.equal(page.status, 200);
      assert.match(page.body, /Log in to Clay/);
      assert.match(page.body, /id="password"/);
    });

    it('says why a sign in failed, once, and goes back to the login page', async () => {
      const app = await make();

      for (const [body, message] of [[{ username: 'bob', password: 'nope' }, 'Invalid Password'], [{ username: 'nobody', password: 'secret' }, 'User not found!'], [{ username: 'bob' }, 'Missing credentials']]) {
        const failed = await app.request('POST', '/_auth/local', { body, form: true }),
          page = await app.request('GET', '/_auth/login'),
          again = await app.request('GET', '/_auth/login');

        assert.deepEqual([failed.status, failed.location], [302, loginPage]);
        assert.match(page.body, new RegExp(`<div class="flash-error">${message}</div>`));
        assert.doesNotMatch(again.body, /flash-error">/);
      }
    });

    it('signs in, goes to where the user was going, and knows them after', async () => {
      const app = await make();

      await app.request('GET', '/page?edit=true');
      const signedIn = await app.request('POST', '/_auth/local', { body: login, form: true }),
        edit = await app.request('GET', '/page?edit=true'),
        sessions = app.store.dump();

      assert.deepEqual([signedIn.status, signedIn.location], [302, '/page?edit=true']);
      assert.deepEqual(edit.body, { user: 'bob', auth: 'admin' });
      assert.deepEqual(sessions.map(s => s.passport), [{ user: encode('bob', 'local') }]);
      assert.equal(sessions[0].returnTo, undefined);
    });

    it('takes the login as json too, and goes to the site when there was nowhere to go', async () => {
      const app = await make(),
        signedIn = await app.request('POST', '/_auth/local', { body: login });

      assert.deepEqual([signedIn.status, signedIn.location], [302, '/']);
    });

    it('lets a user do what is of their level', async () => {
      const app = await make();

      await app.request('POST', '/_auth/local', { body: { username: 'wendy', password: 'secret' }, form: true });
      assert.deepEqual((await app.request('PUT', '/api/thing', { body: {} })).body, { ok: 'write' });
      const admin = await app.request('POST', '/admin', { body: {} });

      assert.deepEqual([admin.status, admin.body], [401, { code: 401, message: 'Unauthorized request' }]);
    });

    it('shows who is signed in on the login page', async () => {
      const app = await make();

      await app.request('POST', '/_auth/local', { body: login, form: true });
      const page = await app.request('GET', '/_auth/login');

      assert.match(page.body, /Welcome, bob/);
      assert.match(page.body, /href="http:\/\/localhost:3000\/_auth\/logout"/);
    });

    it('signs out, and sends the user to the login page', async () => {
      const app = await make();

      await app.request('POST', '/_auth/local', { body: login, form: true });
      const out = await app.request('GET', '/_auth/logout'),
        edit = await app.request('GET', '/page?edit=true');

      assert.deepEqual([out.status, out.location], [302, loginPage]);
      assert.deepEqual([edit.status, edit.location], [302, loginPage]);
      assert.equal(app.store.dump().every(s => !s.passport || s.passport.user === undefined), true);
    });

    it('stores nothing for someone who signs out without being signed in', async () => {
      const app = await make(),
        out = await app.request('GET', '/_auth/logout');

      assert.deepEqual([out.status, out.location, out.cookies], [302, loginPage, []]);
      assert.equal(app.store.sessions.size, 0);
    });

    it('signs out a user that was removed, instead of failing', async () => {
      const app = await make();

      await app.request('POST', '/_auth/local', { body: { username: 'wendy', password: 'secret' }, form: true });
      app.storage.data.delete(`/_users/${encode('wendy', 'local')}`);
      const first = await app.request('GET', '/page?edit=true'),
        second = await app.request('GET', '/page?edit=true');

      assert.deepEqual([first.status, first.location], [302, loginPage]);
      assert.deepEqual([second.status, second.location], [302, loginPage]);
    });

    it('keeps the session id when someone signs in or out', async () => {
      const app = await make();

      await app.request('GET', '/page?edit=true');
      const before = app.jar['clay-session'];

      await app.request('POST', '/_auth/local', { body: login, form: true });
      assert.equal(app.jar['clay-session'], before);
      await app.request('GET', '/_auth/logout');
      assert.equal(app.jar['clay-session'], before);
    });
  });

  describe('with an api key', () => {
    it('lets in the right key, for any level', async () => {
      const app = await make();

      assert.deepEqual((await app.request('PUT', '/api/thing', { headers: key, body: {} })).body, { ok: 'write' });
      assert.deepEqual((await app.request('POST', '/admin', { headers: key, body: {} })).body, { ok: 'admin' });
      assert.deepEqual((await app.request('GET', '/page?edit=true', { headers: key })).body, { user: 'apikey', auth: 'admin' });
    });

    it('keeps no session for it', async () => {
      const app = await make();

      await app.request('PUT', '/api/thing', { headers: key, body: {} });
      assert.equal(app.store.sessions.size, 0);
    });

    it('answers 401 to a wrong key, and 400 to a header that is not a token', async () => {
      const app = await make(),
        wrong = await app.request('PUT', '/api/thing', { headers: { authorization: 'token nope' }, body: {}, keepCookies: false });

      assert.deepEqual([wrong.status, wrong.body], [401, 'Unauthorized']);
      for (const authorization of ['token ', 'Bearer test-key', 'Basic dGVzdC1rZXk6', 'token']) {
        const res = await app.request('PUT', '/api/thing', { headers: { authorization }, body: {}, keepCookies: false });

        assert.deepEqual([res.status, res.body], [400, 'Bad Request'], authorization);
      }
    });

    it('sends a request without a key to the login page, unless it only reads', async () => {
      const app = await make();

      assert.deepEqual((await app.request('PUT', '/api/thing', { body: {} })).status, 302);
      assert.equal((await app.request('GET', '/page')).status, 200);
      assert.equal((await app.request('OPTIONS', '/api/thing')).status, 200);
    });
  });

  describe('users', () => {
    const users = '/_users';

    it('lists the users', async () => {
      const app = await make(),
        list = await app.request('GET', users, { headers: { ...key, accept: 'application/json' } });

      assert.deepEqual(list.body, [`127.0.0.1${users}/${encode('bob', 'local')}`, `127.0.0.1${users}/${encode('google.user@example.com', 'google')}`, `127.0.0.1${users}/${encode('wendy', 'local')}`]);
    });

    it('creates a user, with a hashed password, and tells the bus', async () => {
      const app = await make(),
        created = await app.request('POST', users, { headers: key, body: { username: 'Carol', password: 'pw', provider: 'local', auth: 'write' } }),
        stored = JSON.parse(app.storage.data.get(`/_users/${encode('carol', 'local')}`));

      assert.equal(created.status, 200);
      assert.equal(created.body._ref, `/_users/${encode('carol', 'local')}`);
      assert.match(stored.password, /^\$2a\$10\$/);
      assert.equal(bcrypt.compareSync('pw', stored.password), true);
      assert.equal(app.published[0][0], 'saveUser');
    });

    it('reads a user without the password, updates and deletes it', async () => {
      const app = await make(),
        path = `${users}/${encode('bob', 'local')}`,
        accept = { ...key, accept: 'application/json' };

      assert.deepEqual((await app.request('GET', path, { headers: accept })).body, { username: 'bob', provider: 'local', auth: 'admin' });
      assert.equal((await app.request('PUT', path, { headers: key, body: { username: 'bob', provider: 'local', auth: 'write' } })).status, 200);
      assert.equal(JSON.parse(app.storage.data.get(`/_users/${encode('bob', 'local')}`)).auth, 'write');
      assert.equal((await app.request('DELETE', path, { headers: key })).status, 200);
      assert.equal(app.storage.data.has(`/_users/${encode('bob', 'local')}`), false);
      assert.deepEqual(app.published.map(p => p[0]), ['saveUser', 'deleteUser']);
    });

    it('answers what is wrong with a request', async () => {
      const app = await make(),
        accept = { ...key, accept: 'application/json' };

      assert.equal((await app.request('POST', users, { headers: key, body: { username: 'x' } })).status, 500);
      assert.equal((await app.request('POST', users, { headers: key, body: { _ref: 'x', username: 'y', provider: 'local', auth: 'write' } })).status, 400);
      assert.equal((await app.request('GET', `${users}/unknown`, { headers: accept })).status, 404);
      assert.equal((await app.request('DELETE', `${users}/unknown`, { headers: key })).status, 404);
      assert.equal((await app.request('PATCH', users, { headers: key })).status, 405);
      assert.equal((await app.request('GET', users, { headers: { ...key, accept: 'text/xml' } })).status, 406);
      assert.equal((await app.request('GET', `${users}/a/`, { headers: accept })).status, 400);
    });

    it('only lets an admin create users', async () => {
      const app = await make();

      await app.request('POST', '/_auth/local', { body: { username: 'wendy', password: 'secret' }, form: true });
      assert.equal((await app.request('POST', users, { body: { username: 'x', provider: 'local', auth: 'write' } })).status, 401);
    });
  });

  describe('with google', () => {
    it('sends the user to google, asking for the profile and the email', async () => {
      const app = await make({ providers: ['google', 'apikey'] }),
        first = await app.request('GET', '/_auth/google'),
        url = new URL(first.location);

      assert.equal(first.status, 302);
      assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
      assert.equal(url.searchParams.get('client_id'), 'google-key');
      assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/_auth/google/callback');
      assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
    });

    it('signs the user in when google comes back, and goes to where they were going', async () => {
      const app = await make({ providers: ['google', 'apikey'], googleProfile: { sub: '1', email: 'Google.User@Example.com', name: 'G User', picture: 'http://img/1.png' } });

      await app.request('GET', '/page?edit=true');
      const callback = await app.request('GET', '/_auth/google/callback?code=abc'),
        edit = await app.request('GET', '/page?edit=true');

      assert.deepEqual([callback.status, callback.location], [302, '/page?edit=true']);
      assert.deepEqual(edit.body, { user: 'google.user@example.com', auth: 'admin' });
      assert.deepEqual(JSON.parse(app.storage.data.get(`/_users/${encode('google.user@example.com', 'google')}`)), { username: 'google.user@example.com', provider: 'google', auth: 'admin', imageUrl: 'http://img/1.png', name: 'G User' });
    });

    it('goes back to the login page when the user is not a user here', async () => {
      const app = await make({ providers: ['google', 'apikey'], googleProfile: { sub: '2', email: 'stranger@example.com' } }),
        callback = await app.request('GET', '/_auth/google/callback?code=abc'),
        page = await app.request('GET', '/_auth/login');

      assert.deepEqual([callback.status, callback.location], [302, loginPage]);
      assert.match(page.body, /User not found!/);
    });

    it('goes back to the login page when google says no, or the code does not work', async () => {
      const app = await make({ providers: ['google', 'apikey'] });

      for (const path of ['/_auth/google/callback?code=bad', '/_auth/google/callback?error=access_denied']) {
        const res = await app.request('GET', path);

        assert.deepEqual([res.status, res.location], [302, loginPage], path);
      }
    });

    it('sends the user to google again when the callback comes without a code', async () => {
      const app = await make({ providers: ['google', 'apikey'] }),
        res = await app.request('GET', '/_auth/google/callback');

      assert.equal(res.status, 302);
      assert.match(res.location, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    });
  });

  describe('when the session store is down', () => {
    it('serves public pages and the api, and sends editing to the login page, until it is back', async () => {
      const app = await make();

      await app.request('POST', '/_auth/local', { body: login, form: true });
      assert.equal((await app.request('GET', '/page?edit=true')).status, 200);
      app.store.emit('disconnect', new Error('redis is down'));
      assert.deepEqual((await app.request('GET', '/page')).body, { user: null, auth: null });
      assert.equal((await app.request('GET', '/page?edit=true')).status, 302);
      assert.equal((await app.request('PUT', '/api/thing', { headers: key, body: {} })).status, 200);
      assert.equal((await app.request('GET', '/_auth/logout')).location, loginPage);
      app.store.emit('connect');
      assert.equal((await app.request('GET', '/page?edit=true')).status, 200);
    });

    it('shows the login page, not a redirect to itself, and goes back to normal when it is back', async () => {
      const app = await make({ providers: ['google', 'apikey'] });

      app.store.emit('disconnect', new Error('redis is down'));
      assert.equal((await app.request('GET', '/page?edit=true', { cookies: {} })).location, loginPage);

      const login = await app.request('GET', '/_auth/login', { cookies: {} });

      assert.equal(login.status, 200);
      assert.match(login.body, /Log in with Google/);
      assert.match(login.body, /Signing in is not available right now/);

      app.store.emit('connect');
      const back = await app.request('GET', '/_auth/login', { cookies: {} });

      assert.equal(back.status, 200);
      assert.doesNotMatch(back.body, /not available right now/);
    });
  });

  it('reads the hash of the stored users', () => {
    assert.equal(bcrypt.compareSync('secret', hash), true);
  });
});
