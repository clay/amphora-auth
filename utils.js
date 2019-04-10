'use strict';

const _get = require('lodash/get'),
  _defaults = require('lodash/defaults'),
  _map = require('lodash/map'),
  _capitalize = require('lodash/capitalize'),
  _constant = require('lodash/constant'),
  _reject = require('lodash/reject'),
  _last = require('lodash/last'),
  fs = require('fs'),
  path = require('path'),
  handlebars = require('handlebars'),
  references = require('./services/references'),
  { isValidPassword } = require('./services/encrypt');

let db = require('./services/storage');

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
 * @returns {Promise}
 */
function verify(properties) {
  return function (req, token, tokenSecret, profile, done) { // eslint-disable-line
    const username = _get(profile, properties.username),
      imageUrl = _get(profile, properties.imageUrl, ''),
      name = _get(profile, properties.name, ''),
      password = _get(profile, properties.password, ''),
      provider = properties.provider;

    if (!username) {
      throw new Error(`Provider hasn't given a username at ${properties.username}`);
    }

    // get UID
    let uid = `/_users/${encode(username.toLowerCase(), provider)}`;

    if (!req.user) {
      // first time logging in! update the user data
      return db.get(uid)
        .then(data => {
          // only update the user data if the property doesn't exist (name might have been changed through the kiln UI)
          return _defaults(data, {
            imageUrl: imageUrl,
            name: name
          });
        })
        .then(data => {
          return db.put(uid, JSON.stringify(data))
            .then(() => {
              if (password && !isValidPassword(data, password)) {
                return done(null, false, { message: 'Invalid Password' });
              }

              return done(null, data);
            })
            .catch(e => done(e));
        })
        .catch(() => done(null, false, { message: 'User not found!' })); // no user found
    } else {
      // already authenticated. just grab the user data
      return db.get(uid)
        .then(data => {
          if (password && !isValidPassword(data, password)) {
            return done(null, false, { message: 'Invalid Password' });
          }

          return done(null, data);
        })
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
  const index = str.indexOf(prefixToken);

  if (index > -1) {
    str = str.substring(index + prefixToken.length).trim();
  }

  return str;
}

/**
 * Serialize user into the session
 * Note: pull user data from the database,
 * so requests in the same session will get updated user data
 * @param {Object} user
 * @param {Function} done
 */
function serializeUser(user, done) {
  done(null, encode(user.username.toLowerCase(), user.provider));
}

/**
 * Deserialize user from session.
 * @param {string} uid
 * @param {Function} done
 * @returns {Promise<void>}
 */
function deserializeUser(uid, done) {
  return db.get(`/_users/${uid}`)
    .then(user => done(null, user))
    .catch(e => done(e));
}

/**
 * Generates a list of formatted providers
 * @param {string[]} providers
 * @param {Object} site
 * @returns {Object[]}
 */
function getProviders(providers, site) {
  return _map(
    _reject(providers, provider => provider === 'apikey' || provider === 'local'),
    provider => ({
      name: provider,
      url: `${getAuthUrl(site)}/${provider}`,
      title: `Log in with ${_capitalize(provider)}`,
      icon: _constant(provider) // a function that returns the provider
    })
  );
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

/**
 * Returns a normalized URI
 * @param {object} req
 * @returns {string}
 */
function getUri(req) {
  return normalizePath(`${req.hostname}${req.baseUrl}${req.path}`);
}

/**
 * Normalizes an URI
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  return removeExtension(removeQueryString(path));
}

/**
 * Removes extension from route / path.
 * @param {string} path
 * @returns {string}
 */
function removeExtension(path) {
  let endSlash = path.lastIndexOf('/'),
    leadingDot = endSlash > -1
      ? path.indexOf('.', endSlash)
      : path.indexOf('.');

  if (leadingDot > -1) {
    path = path.substr(0, leadingDot);
  }

  return path;
}

/**
 * Removes querystring from route / path.
 * @param  {string} path
 * @return {string}
 */
function removeQueryString(path) {
  return path.split('?')[0];
}

module.exports.encode = encode;
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
module.exports.getUri = getUri;

// For testing purposes
module.exports.setDb = mock => db = mock;
module.exports.removeQueryString = removeQueryString;
module.exports.removeExtension = removeExtension;
