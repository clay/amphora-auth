'use strict';

const STRATEGIES = {
  apikey: require('./key'),
  google: require('./google'),
  ldap: require('./ldap'),
  twitter: require('./twitter'),
  slack: require('./slack')
};

/**
 * create the specified provider strategy
 * @param {object} providers
 * @param {object} site
 * @throws {Error} if unsupported strategy
 */
function createStrategy(providers, site) {
  // Add API Key auth
  STRATEGIES.apikey(site);

  providers.forEach(provider => {
    if (!STRATEGIES[provider]) {
      throw new Error(`Unknown provider: ${provider}!`);
    }

    if (provider !== 'apikey') STRATEGIES[provider](site);
  });
}
/**
 * add authorization routes to the router
 * @param {string[]} providers
 * @param {express.Router} router
 * @param {object} site
 */
function addAuthRoutes(providers, router, site) {
  STRATEGIES.apikey.addAuthRoutes(router, site, 'apikey');

  providers.forEach(provider => {
    if (provider !== 'apikey') STRATEGIES[provider].addAuthRoutes(router, site, provider);
  });
}

module.exports.addAuthRoutes = addAuthRoutes;
module.exports.createStrategy = createStrategy;
