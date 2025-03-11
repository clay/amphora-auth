'use strict';

const passport = require('passport'),
  utils = require('../utils'),
  OIDCStrategy = require('passport-azure-ad').OIDCStrategy,
  {
    verify,
    getAuthUrl,
    getPathOrBase,
    getCallbackUrl,
    generateStrategyName
  } = require('../utils');

/**
 * Active Directory authentication strategy
 *
 * @param {object} site
 */

function createActiveDirectoryOIDCStrategy(site) {
  passport.use(
    `adoidc-${site.slug}`,
    new OIDCStrategy({
      identityMetadata: process.env.AD_OIDC_IDENTITY_METADATA,
      clientID: process.env.AD_OIDC_CLIENT_ID,
      responseMode: process.env.AD_OIDC_RESPONSE_MODE,
      responseType: process.env.AD_OIDC_RESPONSE_TYPE,
      redirectUrl: process.env.AD_OIDC_REDIRECT_URL,
      allowHttpForRedirectUrl: process.env.AD_OIDC_ALLOW_HTTP == 'true',
      clientSecret: process.env.AD_OIDC_CLIENT_SECRET,
      validateIssuer: process.env.AD_OIDC_VALIDATE_ISSUER,
      isB2C: process.env.AD_OIDC_ISB2C,
      issuer: process.env.AD_OIDC_ISSUER,
      passReqToCallback: true,
      scope: process.env.AD_OIDC_SCOPE ? process.env.AD_OIDC_SCOPE.split(',') : null,
      loggingLevel: process.env.AD_OIDC_LOGGING_LEVEL,
      loggingNoPII: process.env.AD_OIDC_LOGGING_NO_PII,
      nonceLifetime: process.env.AD_OIDC_NONCE_LIFETIME,
      nonceMaxAmount: process.env.AD_OIDC_NONCE_MAX_AMOUNT,
      useCookieInsteadOfSession: process.env.AD_OIDC_USE_COOKIE,
      cookieEncryptionKeys: process.env.AD_OIDC_COOKIE_ENCRYPTION,
      clockSkew: process.env.AD_OIDC_CLOCKSKEW
    }, verifyOIDC())
  );
}

/**
 * Wraps verify function for active directory
 * @returns {function}
 */
function verifyOIDC(){
  return function(req, iss, sub, profile, done) {
    utils.verify({
      username: 'preferred_username',
      name: 'name',
      provider: 'adoidc'
    })(req, null, null,  profile._json, done);
  };
}

/**
 * add authorization routes to the router
 * @param {express.Router} router
 * @param {object} site
 * @param {string} provider
 */
function addAuthRoutes(router, site, provider) {
  const strategy = generateStrategyName(provider, site);

  router.get(`/_auth/${provider}`, passport.authenticate(strategy));

  router.post(`/_auth/${provider}/callback`, passport.authenticate(strategy, {
    failureRedirect: `${getAuthUrl(site)}/login`,
    failureFlash: true,
    successReturnToOrRedirect: getPathOrBase(site)
  })); // redirect to previous page or site root
}

module.exports = createActiveDirectoryOIDCStrategy;
module.exports.addAuthRoutes = addAuthRoutes;

// For testing purposes
module.exports.verifyOIDC = verifyOIDC;
