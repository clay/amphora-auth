'use strict';

const { createHash, timingSafeEqual } = require('crypto'),
  passport = require('passport'),
  APIKeyStrategy = require('passport-http-header-token').Strategy,
  { getAuthUrl, getPathOrBase, generateStrategyName } = require('../utils');

/**
 * compare two strings in the same time whatever they have in common
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

/**
 * api key callback, checks to see if api key provided matches env variable
 * @param {string} apikey
 * @param {function} done
 */
function apiCallback(apikey, done) {
  if (safeEqual(apikey, process.env.CLAY_ACCESS_KEY)) {
    // If we're using an API Key then we're assuming the user is
    // has admin privileges by defining the auth level in the next line
    done(null, { provider: 'apikey', auth: 'admin' });
  } else {
    done(null, false, { message: 'Unknown apikey: ' + apikey });
  }
}

/**
 * api key strategy
 * matches against the CLAY_ACCESS_KEY env variable
 * @param {object} site
 */
function createAPIKeyStrategy() {
  passport.use('apikey', new APIKeyStrategy({}, apiCallback));
}

/**
 * add authorization routes to the router
 * @param {express.Router} router
 * @param {object} site
 * @param {object} provider
 */
function addAuthRoutes(router, site, provider) {
  const strategy = generateStrategyName(provider, site);

  router.get(`/_auth/${provider}`, passport.authenticate(strategy));

  router.get(`/_auth/${provider}/callback`, passport.authenticate(strategy, {
    failureRedirect: `${getAuthUrl(site)}/login`,
    failureFlash: true,
    successReturnToOrRedirect: getPathOrBase(site)
  })); // redirect to previous page or site root
}

module.exports = createAPIKeyStrategy;
module.exports.addAuthRoutes = addAuthRoutes;

// For testing purposes
module.exports.apiCallback = apiCallback;
