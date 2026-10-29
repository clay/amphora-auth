'use strict';

// Each strategy is loaded the first time it is used, so a site that signs in with Google and API keys doesn't
// load the LDAP, Twitter, Slack and Cognito packages (the Cognito one brings in the AWS SDK).
const STRATEGIES = {
  apikey: () => require('./key'),
  cognito: () => require('./cognito'),
  google: () => require('./google'),
  ldap: () => require('./ldap'),
  twitter: () => require('./twitter'),
  slack: () => require('./slack'),
  local: () => require('./local')
};

/**
 * get a strategy module (requiring it the first time)
 * @param {string} provider
 * @returns {function}
 * @throws {Error} if unsupported strategy
 */
function getStrategy(provider) {
  if (!Object.hasOwn(STRATEGIES, provider)) {
    throw new Error(`Unknown provider: ${provider}!`);
  }

  return STRATEGIES[provider]();
}

/**
 * create the specified provider strategy
 * @param {object} providers
 * @param {object} site
 * @throws {Error} if unsupported strategy
 */
function createStrategy(providers, site) {
  // Add API Key auth
  getStrategy('apikey')(site);

  providers.forEach(provider => {
    const strategy = getStrategy(provider);

    if (provider !== 'apikey') strategy(site);
  });
}
/**
 * add authorization routes to the router
 * @param {string[]} providers
 * @param {express.Router} router
 * @param {object} site
 */
function addAuthRoutes(providers, router, site) {
  getStrategy('apikey').addAuthRoutes(router, site, 'apikey');

  providers.forEach(provider => {
    if (provider !== 'apikey') getStrategy(provider).addAuthRoutes(router, site, provider);
  });
}

module.exports.addAuthRoutes = addAuthRoutes;
module.exports.createStrategy = createStrategy;
