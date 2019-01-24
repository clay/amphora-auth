'use strict';

const passport = require('passport'),
  GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
  {
    verify,
    getAuthUrl,
    getPathOrBase,
    getCallbackUrl,
    generateStrategyName,
  } = require('../utils');

/**
 * Google authenticatio strategy
 *
 * @param {object} site
 */
function createGoogleStrategy(site) {
  passport.use(`google-${site.slug}`, new GoogleStrategy({
    clientID: process.env.GOOGLE_CONSUMER_KEY,
    clientSecret: process.env.GOOGLE_CONSUMER_SECRET,
    callbackURL: getCallbackUrl(site, 'google'),
    passReqToCallback: true
  },
  verify({
    username: 'emails[0].value',
    imageUrl: 'photos[0].value',
    name: 'displayName',
    provider: 'google'
  }, site)));
}

/**
 * add authorization routes to the router
 * @param {express.Router} router
 * @param {object} site
 * @param {object} provider
 */
function addAuthRoutes(router, site, provider) {
  const strategy = generateStrategyName(provider, site);

  router.get(`/_auth/${provider}`, passport.authenticate(strategy, { scope: [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ]}));

  router.get(`/_auth/${provider}/callback`, passport.authenticate(strategy, {
    failureRedirect: `${getAuthUrl(site)}/login`,
    failureFlash: true,
    successReturnToOrRedirect: getPathOrBase(site)
  })); // redirect to previous page or site root
}

module.exports = createGoogleStrategy;
module.exports.addAuthRoutes = addAuthRoutes;
