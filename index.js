'use strict';
const passport = require('passport'),
  flash = require('./lib/flash'),
  { compileLoginPage } = require('./services/login'),
  {
    getAuthUrl,
    getPathOrBase,
    serializeUser,
    deserializeUser,
    getProviders
  } = require('./utils'),
  createSessionStore = require('./services/session-store'),
  strategyService = require('./strategies'),
  { AUTH_LEVELS, MAINTENANCE_MODE_ENABLED, REGENERATE_SESSION } = require('./constants'),
  { withAuthLevel } = require('./services/auth'),
  { setDb } = require('./services/storage'),
  { setBus } = require('./controllers/users'),
  { isEmpty, includes } = require('./lib/helpers'),
  log = require('./services/logger').setup({ file: __filename }),
  KEEPS_SESSION_INFO = Symbol('keepsSessionInfo');

/**
 * the url of a request without its query string
 * @param {string} [url]
 * @returns {string}
 */
function withoutQuery(url = '') {
  return String(url).split('?')[0];
}

/**
 * determine if a route is protected
 * protected routes are ?edit=true and any method other than GET or HEAD, except the routes with /_auth in their path
 * (the sign in routes, and routes named for them). Only the path of the request counts, not its query string
 * @param {object} req
 * @returns {boolean}
 */
function isProtectedRoute(req) {
  return (
    !!req.query.edit
    || !includes(withoutQuery(req.originalUrl), '/_auth')
    && !includes(['GET', 'HEAD'], req.method)
  );
}

/**
 * where someone who has to sign in is sent: the login page, or the provider itself when CLAY_AUTH_AUTO_LOGIN names one
 * of the providers of the site and the request is someone opening a page (not a script that waits for json), so
 * there is no login page to click through. Signing in at the provider is quick when they are signed in there already
 * @param {object} req
 * @param {object} site
 * @param {string[]} providers
 * @returns {string}
 */
function signInUrl(req, site, providers) {
  const name = process.env.CLAY_AUTH_AUTO_LOGIN,
    opensPage = req.method === 'GET' && typeof req.accepts === 'function' && req.accepts(['html', 'json']) === 'html',
    provider = name && opensPage && getProviders(providers, site).find(current => current.name === name);

  return provider ? provider.url : `${getAuthUrl(site)}/login`;
}

/**
 * protect routes
 * @param {object} site
 * @param {string[]} [providers]
 * @returns {Function}
 */
function isAuthenticated(site, providers) {
  return function (req, res, next) {
    // This variable controls wether or not people can log in to Clay
    // and stops people from being able to make edits to pages.
    // If someone were to edit something on a tab that was already opened,
    // or attempted to go into edit mode, with this flag active,
    // they'd get redirected to a screen displaying a message that the CMS is under maintenance.
    if (MAINTENANCE_MODE_ENABLED) return res.redirect(`${getAuthUrl(site)}/login`);

    if (req.isAuthenticated()) {
      next(); // already logged in
    } else if (req.get('Authorization')) {
      // try to authenticate with api key
      passport.authenticate('apikey', { session: false })(req, res, next);
    } else {
      // redirect to this page after logging in (there is no session to keep it in while the session store is down)
      if (req.session) req.session.returnTo = req.originalUrl;
      // otherwise redirect to login
      res.redirect(signInUrl(req, site, providers));
    }
  };
}

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

/**
 * the actual middleware that protects our routes, plz no hax
 * @param {object} site
 * @param {string[]} [providers]
 * @returns {function}
 */
function protectRoutes(site, providers) {
  return function (req, res, next) {
    if (req.method !== 'OPTIONS' && module.exports.isProtectedRoute(req)) { // allow mocking of these for testing
      module.exports.isAuthenticated(site, providers)(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * the messages for the login page, and what is not there to read them from: express-session leaves the session out
 * while the session store is down, nobody can sign in then, and asking for the messages would throw (and the error
 * handler would send them back to this page, again and again)
 * @param {object} req
 * @returns {object}
 */
function loginMessages(req) {
  return req.session ? req.flash() : { error: ['Signing in is not available right now. Please try again in a few minutes.'] };
}

/**
 * middleware to show login page
 * @param {object} site
 * @param {array} providers
 * @returns {function}
 */
function onLogin(site, providers) {
  return function (req, res) {
    const template = compileLoginPage(),
      currentProviders = getProviders(providers, site),
      authUrl = getAuthUrl(site),
      flash = loginMessages(req);

    if (flash && includes(flash.error, 'Invalid username/password')) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="Incorrect Credentials"');
      res.end('Access denied');
      // this will prompt users one more time for the correct password,
      // then display the login page WITHOUT saving the basic auth credentials.
      // if they hit login, it'll show the auth form again, but won't show it a
      // second time if they enter the wrong info.
      // note: if the user enters the correct info on the second form,
      // it'll show the login page but they'll have to click login again
      // (and it'll automatically log them in without having to re-enter credentials)
      // note: all of the above is the default behavior in amphora, but we're
      // going to use varnish to automatically redirect them back to the ldap auth
    } else {
      res.send(template({
        currentProviders: currentProviders,
        flash: flash,
        localAuthPath: `${authUrl}/local`,
        logoutLink: `${authUrl}/logout`,
        path: getPathOrBase(site),
        maintenanceModeEnabled: MAINTENANCE_MODE_ENABLED,
        useLocalAuth: providers.includes('local'),
        user: req.user
      }));
    }
  };
}

/**
 * middleware to log out. redirects to login page
 * note: it goes to login page because usually users are navigating from edit mode,
 * and they can't be redirected back into edit mode without logging in
 * @param {object} site
 * @returns {function}
 */
function onLogout(site) {
  return function (req, res) {
    const toLogin = () => res.redirect(`${getAuthUrl(site)}/login`);

    // passport 0.6 and later save the session when logging out, which would store an empty one for someone who isn't
    // signed in. A session that has a user that can't be loaded any more (req.user isn't set) still needs to be cleared
    if (!req.user && !req.session?.passport?.user) {
      toLogin();
      return;
    }

    req.logout(function (err) {
      if (err) {
        log('error', 'Could not log out', { error: err });
      }

      toLogin();
    });
  };
}

/**
 * There exists a case in which a user has an active session and
 * is then removed as a user from a Clay instance. We must handle
 * the error by re-directing the user to the login page and logging
 * them out of their current session
 *
 * @param {Object} site
 * @returns {Function}
 */
function checkAuthentication(site) {
  return function (err, req, res, next) {
    if (err) {
      onLogout(site)(req, res);
    } else {
      next();
    }
  };
}

/**
 * add current user to locals
 * @param {req} req
 * @param {res} res
 * @param {function} next
 */
function addUser(req, res, next) {
  res.locals.user = req.user;
  next();
}

/**
 * passport.initialize(), but a session keeps its id when someone signs in or out unless REGENERATE_SESSION is on
 * @returns {function}
 */
function initializePassport() {
  const initialize = passport.initialize();

  return function (req, res, next) {
    if (req.session && !REGENERATE_SESSION) {
      req.session.regenerate = callback => callback();
    }

    initialize(req, res, next);
  };
}

/**
 * passport.session(), skipped when there is no session: express-session leaves it out while the session store is
 * down, and passport 0.6 and later fail the request without one (passport 0.3 let it through as signed out)
 * @returns {function}
 */
function restoreSession() {
  const session = passport.session();

  return function (req, res, next) {
    if (req.session) {
      session(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * When a session is regenerated at sign in, keep what it held (where to go next) unless a route says otherwise
 */
function keepSessionInfo() {
  if (passport.authenticate[KEEPS_SESSION_INFO]) {
    return;
  }

  const authenticate = passport.authenticate,
    keeping = function (strategy, options, callback) {
      if (options === undefined || options !== null && typeof options === 'object') {
        options = Object.assign({ keepSessionInfo: true }, options);
      }

      return authenticate.call(this, strategy, options, callback);
    };

  keeping[KEEPS_SESSION_INFO] = true;
  passport.authenticate = keeping;
}

/**
 * Initialize authentication
 * @param {object} params
 * @param {express.Router} params.router
 * @param {object[]} params.providers (may be empty array)
 * @param {object} params.site //config for the site
 * @param {object} params.storage
 * @returns {object[]}
 */
function init({ router, providers, store, site, storage, bus }) {
  if (isEmpty(providers)) {
    return []; // exit early if no providers are passed in
  }

  setDb(storage);
  setBus(bus);

  const currentProviders = getProviders(providers, site);

  if (REGENERATE_SESSION) {
    keepSessionInfo();
  }

  strategyService.createStrategy(providers, site); // allow mocking this in tests

  // init session authentication
  router.use(createSessionStore(store));
  router.use(initializePassport());
  router.use(restoreSession());
  router.use(flash());

  // protect routes
  router.use(protectRoutes(site, providers));

  // add authorization routes
  // note: these (and the provider routes) are added here,
  // rather than as route controllers in lib/routes/
  router.get('/_auth/login', onLogin(site, providers));
  router.get('/_auth/logout', onLogout(site));
  strategyService.addAuthRoutes(providers, router, site); // allow mocking this in tests

  // handle de-authentication errors. This occurs when a user is logged in
  // and someone removes them as a user. We need to catch the error
  router.use(checkAuthentication(site));
  router.use(addUser);

  return currentProviders; // for testing/verification
}

module.exports = init;
module.exports.withAuthLevel = withAuthLevel;
module.exports.authLevels = AUTH_LEVELS;
module.exports.addRoutes = require('./routes/_users');

// for testing
module.exports.isProtectedRoute = isProtectedRoute;
module.exports.isAuthenticated = isAuthenticated;
module.exports.protectRoutes = protectRoutes;
module.exports.checkAuthentication = checkAuthentication;
module.exports.onLogin = onLogin;
module.exports.onLogout = onLogout;
module.exports.addUser = addUser;
