'use strict';
const _isEmpty = require('lodash/isEmpty'),
  _includes = require('lodash/includes'),
  passport = require('passport'),
  flash = require('express-flash'),
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
  { AUTH_LEVELS } = require('./constants'),
  { withAuthLevel } = require('./services/auth'),
  { setDb } = require('./services/storage'),
  { setBus } = require('./controllers/users');

/**
 * determine if a route is protected
 * protected routes are ?edit=true and any method other than GET
 * @param {object} req
 * @returns {boolean}
 */
function isProtectedRoute(req) {
  return !!req.query.edit || !_includes(req.originalUrl, '/_auth') && req.method !== 'GET';
}

/**
 * protect routes
 * @param {object} site
 * @returns {Function}
 */
function isAuthenticated(site) {
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      next(); // already logged in
    } else if (req.get('Authorization')) {
      // try to authenticate with api key
      passport.authenticate('apikey', { session: false })(req, res, next);
    } else {
      req.session.returnTo = req.originalUrl; // redirect to this page after logging in
      // otherwise redirect to login
      res.redirect(`${getAuthUrl(site)}/login`);
    }
  };
}

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

/**
 * the actual middleware that protects our routes, plz no hax
 * @param {object} site
 * @returns {function}
 */
function protectRoutes(site) {
  return function (req, res, next) {
    if (req.method !== 'OPTIONS' && module.exports.isProtectedRoute(req)) { // allow mocking of these for testing
      module.exports.isAuthenticated(site)(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * middleware to show login page
 * @param {object} site
 * @param {array} currentProviders
 * @returns {function}
 */
function onLogin(site, currentProviders) {
  return function (req, res) {
    const template = compileLoginPage(),
      flash = req.flash();

    if (flash && _includes(flash.error, 'Invalid username/password')) {
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
        path: getPathOrBase(site),
        flash: flash,
        currentProviders: currentProviders,
        user: req.user,
        logoutLink: `${getAuthUrl(site)}/logout`
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
    req.logout();
    res.redirect(`${getAuthUrl(site)}/login`);
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
 * Initialize authentication
 * @param {object} params
 * @param {express.Router} params.router
 * @param {object[]} params.providers (may be empty array)
 * @param {object} params.site //config for the site
 * @param {object} params.storage
 * @returns {object[]}
 */
function init({ router, providers, store, site, storage, bus }) {
  if (_isEmpty(providers)) {
    return []; // exit early if no providers are passed in
  }

  setDb(storage);
  setBus(bus);

  const currentProviders = getProviders(providers, site);

  strategyService.createStrategy(providers, site); // allow mocking this in tests

  // init session authentication
  router.use(createSessionStore(store));
  router.use(passport.initialize());
  router.use(passport.session());
  router.use(flash());

  // protect routes
  router.use(protectRoutes(site));

  // add authorization routes
  // note: these (and the provider routes) are added here,
  // rather than as route controllers in lib/routes/
  router.get('/_auth/login', onLogin(site, currentProviders));
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
