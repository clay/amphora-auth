'use strict';

const _ = require('lodash'),
  references = require('./references');
var db; // Storage module passed from Amphora. Assigned value at initialization

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
  var base = references.uriToUrl(site.prefix, site.protocol, site.port);

  return _.last(base) === '/' ? `${base}_auth` : `${base}/_auth`;
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
    var username = _.get(profile, properties.username),
      imageUrl = _.get(profile, properties.imageUrl),
      name = _.get(profile, properties.name),
      provider = properties.provider,
      uid;

    if (!username) {
      throw new Error('Provider hasn\'t given a username at ' + properties.username);
    }

    // get UID
    uid = `/_users/${encode(`${username.toLowerCase()}`, provider)}`;

    if (!req.user) {
      // first time logging in! update the user data
      return db.get(uid)
        .then(function (data) {
          // only update the user data if the property doesn't exist (name might have been changed through the kiln UI)
          return _.defaults(data, {
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
          console.log(e)
          done(null, false, { message: 'User not found!' });
        }); // no user found
    } else {
      console.log('&&&')
      // already authenticated. just grab the user data
      return db.get(uid)
        .then((data) => done(null, data))
        .catch(e => {
          console.log('%%%%', e)
          done(null, false, { message: 'User not found!' })
        }); // no user found
    }
  };
}

module.exports.setDb = storage => db = storage;
module.exports.getPathOrBase = getPathOrBase;
module.exports.getAuthUrl = getAuthUrl;
module.exports.getCallbackUrl = getCallbackUrl;
module.exports.verify = verify;
