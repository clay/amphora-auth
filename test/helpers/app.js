'use strict';

// an express app wired the way amphora wires this package, and a small http client with a cookie jar

const http = require('http'),
  { text: readText } = require('stream/consumers'),
  express = require('express'),
  session = require('express-session'),
  passport = require('passport'),
  bcrypt = require('bcryptjs'),
  auth = require('../../index'),
  { createStorage } = require('./mocks'),
  encode = (username, provider) => Buffer.from(`${username}@${provider}`).toString('base64'),
  hash = bcrypt.hashSync('secret', 4);

/** a session store that keeps JSON strings (like redis does) */
class TestStore extends session.Store {
  constructor() {
    super();
    this.sessions = new Map();
  }

  get(sid, cb) {
    cb(null, this.sessions.has(sid) ? JSON.parse(this.sessions.get(sid)) : null);
  }

  set(sid, sess, cb) {
    this.sessions.set(sid, JSON.stringify(sess));
    cb();
  }

  touch(sid, sess, cb) {
    cb();
  }

  destroy(sid, cb) {
    this.sessions.delete(sid);
    cb();
  }

  /** @returns {object[]} what is stored, with the dates left out */
  dump() {
    return [...this.sessions.values()].map(json => {
      const sess = JSON.parse(json);

      delete sess.cookie.expires;
      return sess;
    });
  }
}

/**
 * @param {object} [options]
 * @param {string[]} [options.providers]
 * @param {object} [options.googleProfile] what the (stubbed) google answers for the profile
 * @returns {Promise<object>}
 */
async function build(options = {}) {
  const store = new TestStore(),
    storage = createStorage({
      [`/_users/${encode('bob', 'local')}`]: { username: 'bob', provider: 'local', auth: 'admin', password: hash },
      [`/_users/${encode('wendy', 'local')}`]: { username: 'wendy', provider: 'local', auth: 'write', password: hash },
      [`/_users/${encode('google.user@example.com', 'google')}`]: { username: 'google.user@example.com', provider: 'google', auth: 'admin' }
    }),
    published = [],
    app = express(),
    router = express.Router(),
    users = express.Router(),
    providers = options.providers || ['local', 'apikey'],
    jar = {};

  app.set('trust proxy', true);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  auth({
    router,
    providers,
    store: options.store || store,
    site: { slug: 'site', host: 'localhost', prefix: 'localhost', path: '/', protocol: 'http', port: 3000 },
    storage,
    bus: { publish: (...args) => published.push(args) }
  });
  router.use((req, res, next) => {
    req.uri = `${req.hostname}${req.baseUrl}${req.path}`;
    next();
  });
  router.get('/page', (req, res) => res.json({ user: req.user ? req.user.username || req.user.provider : null, auth: req.user ? req.user.auth : null }));
  router.put('/api/thing', auth.withAuthLevel(auth.authLevels.WRITE), (req, res) => res.json({ ok: 'write' }));
  router.post('/admin', auth.withAuthLevel(auth.authLevels.ADMIN), (req, res) => res.json({ ok: 'admin' }));
  // routes of a site or a plugin that have no check of their own, and one that is named for the auth routes
  router.post('/open', (req, res) => res.json({ reached: 'open' }));
  router.post('/hooks/_auth/notify', (req, res) => res.json({ reached: 'auth in the name' }));
  auth.addRoutes(users);
  router.use('/_users', users);
  app.use(router);

  if (providers.includes('google')) { // answer for google instead of calling it
    const google = passport._strategy('google-site');

    google._oauth2.getOAuthAccessToken = (code, params, cb) => cb(null, code === 'bad' ? null : 'access-token', 'refresh', {});
    google._oauth2.get = (url, token, cb) => cb(null, JSON.stringify(options.googleProfile || { sub: '1', email: 'google.user@example.com', name: 'G User' }), {});
  }

  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  /**
   * sent with node's http client rather than fetch, which adds headers of its own (Accept, Sec-Fetch-Mode): a request
   * carries only the headers a test gives it, and the path is sent as it is (a whole url, or with a #fragment)
   * @param {string} method
   * @param {string} path
   * @param {object} [opts] headers, body (an object), form (send it as a form), cookies (instead of the jar), keepCookies (false: don't remember what comes back)
   * @returns {Promise<{status: number, location: string, cookies: string[], headers: object, body: *}>}
   */
  async function request(method, path, opts = {}) {
    const headers = { 'x-forwarded-proto': 'https', ...opts.headers },
      cookie = Object.entries(opts.cookies || jar).map(([k, v]) => `${k}=${v}`).join('; ');
    let body = opts.body;

    if (cookie) {
      headers.cookie = cookie;
    }

    if (body && opts.form) {
      body = new URLSearchParams(body).toString();
      headers['content-type'] = 'application/x-www-form-urlencoded';
    } else if (body) {
      body = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }

    if (body) {
      headers['content-length'] = Buffer.byteLength(body);
    }

    const res = await new Promise((resolve, reject) => {
        http.request({ host: '127.0.0.1', port: server.address().port, method, path, headers, agent: false }, resolve)
          .on('error', reject)
          .end(body);
      }),
      text = await readText(res),
      cookies = res.headers['set-cookie'] || [];

    cookies.forEach(setCookie => {
      const [pair] = setCookie.split(';'),
        at = pair.indexOf('=');

      if (opts.keepCookies !== false) {
        jar[pair.slice(0, at)] = pair.slice(at + 1);
      }
    });

    let parsed = text;

    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // html or plain text
    }

    return { status: res.statusCode, location: res.headers.location || null, cookies, headers: res.headers, body: parsed };
  }

  return { request, store, storage, published, jar, close: () => new Promise(resolve => server.close(resolve)) };
}

module.exports.build = build;
module.exports.TestStore = TestStore;
module.exports.encode = encode;
module.exports.hash = hash;
