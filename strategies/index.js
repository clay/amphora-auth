'use strict';

const _ = require('lodash'),
  fs = require('fs'),
  utils = require('../utils'),
  path = require('path'),
  handlebars = require('handlebars'),
  STRATEGIES = {
    google: require('./google'),
    ldap: require('./ldap'),
    apikey: require('./key')
  };

function getProviders(providers, site) {
  return _.map(_.reject(providers, (provider) => provider === 'apikey'), provider => {
    return {
      name: provider,
      url: `${utils.getAuthUrl(site)}/${provider}`,
      title: `Log in with ${_.capitalize(provider)}`,
      icon: _.constant(provider) // a function that returns the provider
    };
  });
}

/**
 * create the specified provider strategy
 * @param {object} site
 * @throws {Error} if unsupported strategy
 * @returns {Function}
 */
function createStrategy(router, providers, site) {
  // Add API Key auth
  STRATEGIES.apikey(site);

  providers.forEach(provider => {
    if (!STRATEGIES[provider]) {
      throw new Error(`Unknown provider: ${provider}!`);
    }

    STRATEGIES[provider](site);
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
module.exports.compileLoginPage = compileLoginPage;
module.exports.compileTemplate = compileTemplate;
