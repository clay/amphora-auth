'use strict';

const _map = require('lodash/map'),
  _capitalize = require('lodash/capitalize'),
  _constant = require('lodash/constant'),
  _reject = require('lodash/reject'),
  utils = require('../utils'),
  STRATEGIES = {
    apikey: require('./key'),
    google: require('./google'),
    ldap: require('./ldap'),
    twitter: require('./twitter'),
    slack: require('./slack')
  };

function getProviders(providers, site) {
  return _map(_reject(providers, provider => provider === 'apikey'), provider => ({
    name: provider,
    url: `${utils.getAuthUrl(site)}/${provider}`,
    title: `Log in with ${_capitalize(provider)}`,
    icon: _constant(provider) // a function that returns the provider
  }));
}

/**
 * create the specified provider strategy
 * @param {object} providers
 * @param {object} site
 * @throws {Error} if unsupported strategy
 */
function createStrategy(providers, site) {
  console.log('createStrategy');
  // Add API Key auth
  STRATEGIES.apikey(site);

  providers.forEach(provider => {
    if (!STRATEGIES[provider]) {
      throw new Error(`Unknown provider: ${provider}!`);
    }

    if (provider !== 'apikey') {
      console.log(`Creating strategy for ${provider}-${site.slug}`);
      STRATEGIES[provider](site);
    }
  });
}

function addAuthRoutes(providers, router, site) {
  providers.forEach(provider => {
    // TODO: MAKE SURE API KEY ALWAYS GETS CALLED FIRST
    STRATEGIES[provider].addAuthRoutes(router, site, provider);
  });
}

module.exports.addAuthRoutes = addAuthRoutes;
module.exports.createStrategy = createStrategy;
module.exports.getProviders = getProviders;
