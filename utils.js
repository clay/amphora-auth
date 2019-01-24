'use strict';

const _get = require('lodash/get'),
  _last = require('lodash/last'),
  _defaults = require('lodash/defaults'),
  _map = require('lodash/map'),
  _capitalize = require('lodash/capitalize'),
  _constant = require('lodash/constant'),
  _reject = require('lodash/reject'),
  fs = require('fs'),
  path = require('path'),
  handlebars = require('handlebars'),
  references = require('./references');
let db; // Storage module passed from Amphora. Assigned value at initialization

/**
 * encode username and provider to base64
 * @param {string} username
 * @param {string} provider
 * @returns {string}
 */
function encode(username, provider) {
  const buf = Buffer.from(`${username}@${provider}`, 'utf8');

  return buf.toString('base64');
}

/**
 * get the proper /auth url for a site
 * note: needs to add/not add initial slash, depending on the site path
 * @param {object} site
 * @returns {string}
 */
function getAuthUrl(site) {
  const base = references.uriToUrl(site.prefix, site.protocol, site.port);

  return _last(base) === '/' ? `${base}_auth` : `${base}/_auth`;
}

/**
 * get the proper site path for redirects
 * note: this is needed because some sites have emptystring paths
 * @param {object} site
 * @returns {string}
 */
function getPathOrBase(site) {
  return site.path || '/';
}

/**
 * get callback url for a site
 * @param {object} site
 * @param {string} provider
 * @returns {string}
 */
function getCallbackUrl(site, provider) {
  return `${getAuthUrl(site)}/${provider}/callback`;
}

/**
 * create/authenticate against a clay user
 *
 * @param {object} properties to grab from provider and provider name itself
 * @param {object} site
 * @returns {Promise}
 */
function verify(properties) {
  return function (req, token, tokenSecret, profile, done) { // eslint-disable-line
    const username = _get(profile, properties.username),
      imageUrl = _get(profile, properties.imageUrl),
      name = _get(profile, properties.name),
      provider = properties.provider;

    if (!username) {
      throw new Error('Provider hasn\'t given a username at ' + properties.username);
    }

    // get UID
    let uid = `/_users/${encode(`${username.toLowerCase()}`, provider)}`;

    if (!req.user) {
      // first time logging in! update the user data
      return db.get(uid)
        .then(function (data) {
          // only update the user data if the property doesn't exist (name might have been changed through the kiln UI)
          return _defaults(data, {
            imageUrl: imageUrl,
            name: name
          });
        })
        .then(function (data) {
          return db.put(uid, JSON.stringify(data))
            .then(() => done(null, data))
            .catch(e => done(e));
        })
        .catch(() => {
          done(null, false, { message: 'User not found!' });
        }); // no user found
    } else {
      // already authenticated. just grab the user data
      return db.get(uid)
        .then((data) => done(null, data))
        .catch(() => done(null, false, { message: 'User not found!' })); // no user found
    }
  };
}

/**
 * Finds prefixToken, and removes it and anything before it.
 *
 * @param {string} str
 * @param {string} prefixToken
 * @returns {string}
 */
function removePrefix(str, prefixToken) {
  const index =  str.indexOf(prefixToken);

  if (index > -1) {
    str = str.substring(index + prefixToken.length).trim();
  }

  return str;
}

// serialize and deserialize users into the session
// note: pull user data from the database,
// so requests in the same session will get updated user data
function serializeUser(user, done) {
  done(null, encode(user.username.toLowerCase(), user.provider));
}

function deserializeUser(uid, done) {
  return db.get(`/_users/${uid}`)
    .then(function (user) {
      done(null, user);
    })
    .catch(function (e) {
      done(e);
    });
}

/**
 * Generates a list of formatted providers
 * @param {string[]} providers
 * @param {Object} site
 * @returns {Object[]}
 */
function getProviders(providers, site) {
  return _map(_reject(providers, provider => provider === 'apikey'), provider => ({
    name: provider,
    url: `${getAuthUrl(site)}/${provider}`,
    title: `Log in with ${_capitalize(provider)}`,
    icon: _constant(provider) // a function that returns the provider
  }));
}

/**
 * Generates a string to set passport strategy.
 * @param {string} provider
 * @param {Object} site
 * @returns {string}
 */
function generateStrategyName(provider, site) {
  return `${provider}-${site.slug}`;
}

/**
 * Compile a handlebars template
 * @param {string} filename
 * @returns {function}
 */
function compileTemplate(filename) {
  return handlebars.compile(fs.readFileSync(path.resolve(__dirname, '.', 'views', filename), { encoding: 'utf-8' }));
}

module.exports.encode = encode;
module.exports.setDb = storage => db = storage;
module.exports.getPathOrBase = getPathOrBase;
module.exports.getAuthUrl = getAuthUrl;
module.exports.getCallbackUrl = getCallbackUrl;
module.exports.verify = verify;
module.exports.removePrefix = removePrefix;
module.exports.serializeUser = serializeUser;
module.exports.deserializeUser = deserializeUser;
module.exports.getProviders = getProviders;
module.exports.generateStrategyName = generateStrategyName;
module.exports.compileTemplate = compileTemplate;
