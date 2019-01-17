'use strict';

const passport = require('passport'),
  APIKeyStrategy = require('passport-http-header-token').Strategy;

/**
 * api key callback, checks to see if api key provided matches env variable
 * @param {string} apikey
 * @param {function} done
 */
function apiCallback(apikey, done) {
  if (apikey === process.env.CLAY_ACCESS_KEY) {
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

function addAuthRoutes(router, site, provider) {
  router.get(`/_auth/${provider}`, passport.authenticate(`${provider}-${site.slug}`));
}

module.exports = createAPIKeyStrategy;
module.exports.addAuthRoutes = addAuthRoutes;
