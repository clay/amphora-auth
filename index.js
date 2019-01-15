'use strict';
const _ = require('lodash'),
  { SECRET } = require('./constants'),
  login = require('./login'),
  utils = require('./utils'),

  session = require('express-session'),
  flash = require('express-flash'),

  passport = require('passport'),
  // { getAuthUrl, setDb } = require('./utils'),
  // session = require('express-session'),
  // flash = require('express-flash'),
  // basicAuth = require('basic-auth'),
  // strategies = require('./strategies'),
  AUTH_LEVELS_MAP = {
    ADMIN: 'admin',
    WRITE: 'write'
  };
var db;

function unauthorized(res) {
  const err = new Error('Unauthorized request'),
    message = removePrefix(err.message, ':'),
    code = 401;

  res.stats(code).json({ code, message })
}

/**
 * Check the auth level to see if a user
 * has sufficient permissions
 *
 * @param  {String} userLevel
 * @param  {String} requiredLevel
 * @return {Boolean}
 */
function checkAuthLevel(userLevel, requiredLevel) {
  // User has to have an auth level set
  if (!userLevel) {
    throw new Error('User does not have an authentication level set');
  }

  if (userLevel === AUTH_LEVELS_MAP.ADMIN) {
    return true;
  } else if (userLevel !== requiredLevel) {
    return false;
  } else {
    return true;
  }
}

/**
 * Get the user auth level and check it against the
 * required auth level for a route. Send an error
 * if the user doesn't have permissions
 *
 * @param  {String} requiredLevel
 * @return {Function}
 */
function withAuthLevel(requiredLevel) {
  return function (req, res, next) {
    if (checkAuthLevel(_.get(req, 'user.auth', ''), requiredLevel)) {
      // If the user exists and meets the level requirement, let the request proceed
      next();
    } else {
      // None of the above, we need to error
      unauthorized(res);
    }
  };
}

/**
 * determine if a route is protected
 * protected routes are ?edit=true and any method other than GET
 * @param {object} req
 * @returns {boolean}
 */
function isProtectedRoute(req) {
  return !!req.query.edit || req.method !== 'GET';
}


/**
 * get the proper site path for redirects
 * note: this is needed because some sites have emptystring paths
 * @param {object} site
 * @returns {string}
 */
function getPathOrBase(site) {
  return site.path || '/';
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
      passport.authenticate('apikey', { session: false})(req, res, next);
    } else {
      console.log('isAuthenticated', req.user)
      req.session.returnTo = req.originalUrl; // redirect to this page after logging in
      // otherwise redirect to login
      res.redirect(`${utils.getAuthUrl(site)}/login`);
    }
  };
};



// serialize and deserialize users into the session
// note: pull user data from the database,
// so requests in the same session will get updated user data
function serializeUser(user, done) {
  console.log('user', user, 'foo')
  done(null, utils.encode(user.username.toLowerCase(), user.provider));
}

function deserializeUser(uid, done) {
  console.log('!&!&!&!&!&!')
  return db.get(`/_users/${uid}`)
    .then(user => done(null, user))
    .catch(e => done(e));
}

/**
 * when LDAP auth fails, ask for username + password natively
 * @param {object} res
 */
function rejectBasicAuth(res) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic');
  res.end('Access denied');
}

/**
 * the actual middleware that protects our routes, plz no hax
 * @param {object} site
 * @returns {function}
 */
function protectRoutes(site) {
  return function (req, res, next) {
    console.log('protect', req.user)
    if (req.method !== 'OPTIONS' && amphoraPassport.isProtectedRoute(req)) { // allow mocking of these for testing
      module.exports.isAuthenticated(site)(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * middleware to show login page
 * @param {function} tpl
 * @param {object} site
 * @param {array} currentProviders
 * @returns {function}
 */
function onLogin(tpl, site, currentProviders) {
  return function (req, res) {
    var flash = req.flash();

    if (flash && _.includes(flash.error, 'Invalid username/password')) {
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
      res.send(tpl({
        path: getPathOrBase(site),
        flash: flash,
        currentProviders: currentProviders,
        user: req.user,
        logoutLink: `${utils.getAuthUrl(site)}/logout`
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
    res.redirect(`${utils.getAuthUrl(site)}/login`);
  };
}

/**
 * There exists a case in which a user has an active session and
 * is then removed as a user from a Clay instance. We must handle
 * the error by re-directing the user to the login page and logging
 * them out of their current session
 *
 * @param  {Object} site
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
 * initialize authentication
 * @param {express.Router} router
 * @param {array} providers (may be empty array)
 * @param {object} site config for the site
 * @param {object} [sessionStore]
 * @returns {array}
 */
// function init(router, providers, site, storage) {
//   const currentProviders = strategies.getProviders(providers, site),
//     tpl = strategies.compileLoginPage(),
//     sessionStore = require('./session-store')();

//   db = storage;
//   // Get the db object into the util module's scope
//   setDb(storage);

//   if (_.isEmpty(providers)) {
//     return []; // exit early if no providers are passed in
//   }

//   strategies.createStrategy(router, providers, site);

//   // init session authentication
//   router.use(session({
//     secret: SECRET,
//     resave: false, // please use a session store (like connect-redis) that supports .touch()
//     saveUninitialized: false,
//     rolling: true,
//     name: 'clay-session',
//     cookie: {
//       maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
//     },
//     store: sessionStore
//   }));
//   router.use(passport.initialize());
//   router.use(passport.session());
//   router.use(flash());

//   // protect routes
//   router.use(protectRoutes(site));

//   // add authorization routes
//   // note: these (and the provider routes) are added here,
//   // rather than as route controllers in lib/routes/
//   router.get('/_auth/login', onLogin(tpl, site, currentProviders));
//   router.get('/_auth/logout', onLogout(site));

//   strategies.addAuthRoutes(providers, router, site);

//   // handle de-authentication errors. This occurs when a user is logged in
//   // and someone removes them as a user. We need to catch the error
//   router.use(checkAuthentication(site));

//   return currentProviders; // for testing/verification
// }

function init(router, providers, site, storage, createStrategy, addAuthRoutes) {
  const tpl = login.compileLoginPage('login.handlebars'),
    sessionStore = require('./session-store')(),
    // icons = ['clay-logo', 'twitter', 'google', 'slack', 'ldap', 'logout'],
    currentProviders = _.map(_.reject(providers, (provider) => provider === 'apikey'), function (provider) {
      return {
        name: provider,
        url: `${utils.getAuthUrl(site)}/${provider}`,
        title: `Log in with ${_.capitalize(provider)}`,
        icon: _.constant(provider) // a function that returns the provider
      };
    });

  db = storage;

  if (_.isEmpty(providers)) {
    return []; // exit early if no providers are passed in
  }

  // add svgs to handlebars
  // _.each(icons, function (icon) {
  //   handlebars.registerPartial(icon, login.compileTemplate(`${icon}.svg`));
  // });

  _.each(providers, createStrategy(site)); // allow mocking this in tests

  // init session authentication
  router.use(session({
    secret: 'clay',
    resave: false, // please use a session store (like connect-redis) that supports .touch()
    saveUninitialized: false,
    rolling: true,
    name: 'clay-session',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: sessionStore
  }));
  router.use(passport.initialize());
  router.use(passport.session());
  router.use(flash());

  // protect routes
  router.use(protectRoutes(site));

  // add authorization routes
  // note: these (and the provider routes) are added here,
  // rather than as route controllers in lib/routes/
  router.get('/_auth/login', onLogin(tpl, site, currentProviders));
  router.get('/_auth/logout', onLogout(site));
  _.each(providers, addAuthRoutes(router, site)); // allow mocking this in tests

  // handle de-authentication errors. This occurs when a user is logged in
  // and someone removes them as a user. We need to catch the error
  router.use(checkAuthentication(site));

  return currentProviders; // for testing/verification
}

module.exports = init;
module.exports.withAuthLevel = withAuthLevel;
module.exports.authLevels = AUTH_LEVELS_MAP;
module.exports.utils = utils;

// for testing
module.exports.isProtectedRoute = isProtectedRoute;
module.exports.isAuthenticated = isAuthenticated;
module.exports.getPathOrBase = getPathOrBase;
module.exports.rejectBasicAuth = rejectBasicAuth;
// module.exports.checkCredentials = checkCredentials;
module.exports.protectRoutes = protectRoutes;
module.exports.checkAuthentication = checkAuthentication;
module.exports.serializeUser = serializeUser;
module.exports.deserializeUser = deserializeUser;
module.exports.onLogin = onLogin;
module.exports.onLogout = onLogout;
