'use strict';

const passport = require('passport'),
  TwitterStrategy = require('passport-twitter').Strategy,
  {
    verify,
    getAuthUrl,
    getPathOrBase,
    getCallbackUrl,
    generateStrategyName
  } = require('../utils');

/**
 * Twitter authenticatio strategy
 *
 * @param {object} site
 */
function createTwitterStrategy(site) {
  passport.use(`twitter-${site.slug}`, new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: getCallbackUrl(site, 'twitter'),
    passReqToCallback: true
  },
  verify({
    username: 'username',
    imageUrl: 'photos[0].value',
    name: 'displayName',
    provider: 'twitter'
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

  router.get(`/_auth/${provider}`, passport.authenticate(strategy));

  router.get(`/_auth/${provider}/callback`, passport.authenticate(strategy, {
    failureRedirect: `${getAuthUrl(site)}/login`,
    failureFlash: true,
    successReturnToOrRedirect: getPathOrBase(site)
  })); // redirect to previous page or site root
}

module.exports = createTwitterStrategy;
module.exports.addAuthRoutes = addAuthRoutes;
