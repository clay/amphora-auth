'use strict';

const _get = require('lodash/get'),
  _last = require('lodash/last'),
  _defaults = require('lodash/defaults'),
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
        .catch(e => {
          console.log(e);
          done(null, false, { message: 'User not found!' });
        }); // no user found
    } else {
      console.log('&&&');
      // already authenticated. just grab the user data
      return db.get(uid)
        .then((data) => done(null, data))
        .catch(e => {
          console.log('%%%%', e);
          done(null, false, { message: 'User not found!' });
        }); // no user found
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

module.exports.encode = encode;
module.exports.setDb = storage => db = storage;
module.exports.getPathOrBase = getPathOrBase;
module.exports.getAuthUrl = getAuthUrl;
module.exports.getCallbackUrl = getCallbackUrl;
module.exports.verify = verify;
module.exports.removePrefix = removePrefix;
