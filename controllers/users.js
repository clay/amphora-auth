'use strict';

const { encode } = require('../utils'),
  encrypt = require('../services/encrypt');
let db = require('../services/storage'),
  bus = require('../services/bus');

/**
 * Adds an user into the db and publishes the action to the bus
 * @param {object} data
 * @returns {Promise}
 */
function createUser(data = {}) {
  const { username, password, provider, auth } = data;
  let uri = '/_users/';

  // Validate payload
  if (!username || !provider || !auth) {
    throw new Error('Users require username, provider and auth to be specified!');
  }

  if (password) {
    data.password = encrypt.hashPassword(password);
  }

  // Add the encoded username and provider to the end of the uri
  uri += encode(username.toLowerCase(), provider);

  // Save to the DB
  return db.put(uri, JSON.stringify(data)).then(() => {
    data._ref = uri;

    bus.publish('saveUser', { key: uri, value: data });
    return data;
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
