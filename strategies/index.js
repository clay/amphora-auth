'use strict';

/**
 * the LDAP strategy needs passport-ldapauth, an optional peer dependency: say so when it isn't installed
 * @returns {function}
 * @throws {Error} if passport-ldapauth is missing
 */
function loadLdap() {
  try {
    return require('./ldap');
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && /passport-ldapauth/.test(e.message)) {
      throw new Error('Provider ldap needs the passport-ldapauth package, which is not installed with amphora-auth. Run: npm install passport-ldapauth@^2.1.1', { cause: e });
    }

    throw e;
  }
}

// Each strategy is loaded the first time it is used, so a site that signs in with Google and API keys doesn't
// load the LDAP package (which is not even installed with this one: it is an optional peer dependency).
const STRATEGIES = {
    apikey: () => require('./key'),
    google: () => require('./google'),
    ldap: loadLdap,
    local: () => require('./local')
  },
  // providers of 2.x that are gone, so a site that still lists one is told why
  REMOVED = ['cognito', 'slack', 'twitter'];

/**
 * get a strategy module (requiring it the first time)
 * @param {string} provider
 * @returns {function}
 * @throws {Error} if unsupported strategy
 */
function getStrategy(provider) {
  if (!Object.hasOwn(STRATEGIES, provider)) {
    if (REMOVED.includes(provider)) {
      throw new Error(`Provider ${provider} was removed in amphora-auth 3. Use one of: ${Object.keys(STRATEGIES).join(', ')}!`);
    }

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
