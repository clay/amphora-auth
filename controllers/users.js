'use strict';

const { encode, generateAPIKey } = require('../utils'),
  encrypt = require('../services/encrypt');
let db = require('../services/storage'),
  bus;

/**
 * Adds an user into the db and publishes the action to the bus
 * @param {object} data
 * @returns {Promise}
 */
function createUser(data = {}) {
  const { username, password, provider, auth, apikey } = data;
  let uri = '/_users/', key = { apikey: null, hash: null };

  // Validate payload
  if (!username || !provider || !auth) {
    throw new Error('Users require username, provider and auth to be specified!');
  }

  if (password) {
    data.password = encrypt.hashPassword(password);
  }

  if (apikey === true) {
    key = generateAPIKey(username, provider);
  }

  data.apikey = key.hash;

  // Add the encoded username and provider to the end of the uri
  uri += encode(username.toLowerCase(), provider);

  // Save to the DB
  return db.put(uri, JSON.stringify(data)).then(() => {
    data._ref = uri;

    bus.publish('saveUser', { key: uri, value: data });
    return { ...data, apikey: key.apikey };
  });
}

/**
 * Removes an user from the db and publishes the action to the bus
 * @param {string} uri
 * @returns {Promise<Object>}
 */
function deleteUser(uri = '') {
  return db.get(uri)
    .then(oldData => {
      return db.del(uri)
        .then(() => {
          bus.publish('deleteUser', { uri });
          return oldData;
        });
    });
}

// outsiders can act on users
module.exports.createUser = createUser;
module.exports.deleteUser = deleteUser;

// For testing
module.exports.setDb = mock => db = mock;
module.exports.setBus = mock => bus = mock;
