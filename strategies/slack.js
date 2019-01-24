'use strict';

const passport = require('passport'),
  SlackStrategy = require('passport-slack').Strategy,
  {
    verify,
    getAuthUrl,
    getPathOrBase,
    getCallbackUrl,
    generateStrategyName
  } = require('../utils');

/**
 * Slack authenticatio strategy
 *
 * @param {object} site
 */
function createSlackStrategy(site) {
  passport.use(`slack-${site.slug}`, new SlackStrategy({
    clientID: process.env.SLACK_CONSUMER_KEY,
    clientSecret: process.env.SLACK_CONSUMER_SECRET,
    callbackURL: getCallbackUrl(site, 'slack'),
    passReqToCallback: true,
    scope: 'users:read'
  },
  verify({
    username: '_json.user',
    imageUrl: '_json.info.user.profile.image_1024',
    name: '_json.info.user.real_name',
    provider: 'slack'
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

module.exports = createSlackStrategy;
module.exports.addAuthRoutes = addAuthRoutes;
