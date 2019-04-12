'use strict';

const bcrypt = require('bcryptjs');

/**
 * Encrypts a string by salting
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
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
