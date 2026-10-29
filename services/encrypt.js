'use strict';

const bcrypt = require('bcryptjs');

/**
 * Encrypts a string by salting
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  // bcryptjs 3 starts new salts with $2b$ where 2.4.3 used $2a$. The hash is the same either way; keep the prefix
  // the stored hashes have had
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10).replace(/^\$2b\$/, () => '$2a$'));
}

/**
 * Verifies whether the encrypted password is valid or not
 * @param {Object} user
 * @param {string} password
 * @returns {boolean}
 */
function isValidPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

module.exports.hashPassword = hashPassword;
module.exports.isValidPassword = isValidPassword;
