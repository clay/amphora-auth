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
  // Add API Key auth
  STRATEGIES.apikey(site);

  providers.forEach(provider => {
    if (!STRATEGIES[provider]) {
      throw new Error(`Unknown provider: ${provider}!`);
    }

    if (provider !== 'apikey') STRATEGIES[provider](site);
  });
}

function addAuthRoutes(providers, router, site) {
  STRATEGIES.apikey.addAuthRoutes(router, site, 'apikey');

  providers.forEach(provider => {
    if (provider !== 'apikey') STRATEGIES[provider].addAuthRoutes(router, site, provider);
  });
}

module.exports.addAuthRoutes = addAuthRoutes;
module.exports.createStrategy = createStrategy;
module.exports.getProviders = getProviders;
