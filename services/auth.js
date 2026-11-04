'use strict';

const { AUTH_LEVELS } = require('../constants'),
  { removePrefix } = require('../utils');

/**
 * Creates an error message for unathorized requests.
 * @param {Object} res
 */
function unauthorized(res) {
  const err = new Error('Unauthorized request'),
    message = removePrefix(err.message, ':'),
    code = 401;

  res.status(code).json({ code, message });
}

/**
 * Check the auth level to see if a user
 * has sufficient permissions
 *
 * @param  {String} userLevel
 * @param  {String} requiredLevel
 * @return {Boolean}
 */
function checkAuthLevel(userLevel, requiredLevel) {
  // User has to have an auth level set
  if (!userLevel) {
    throw new Error('User does not have an authentication level set');
  }

  return userLevel === AUTH_LEVELS.ADMIN || userLevel === requiredLevel;
}

/**
 * Get the user auth level and check it against the
 * required auth level for a route. Send an error
 * if the user doesn't have permissions
 *
 * @param  {String} requiredLevel
 * @return {Function}
 */
function withAuthLevel(requiredLevel) {
  return function (req, res, next) {
    if (checkAuthLevel(req?.user?.auth ?? '', requiredLevel)) {
      // If the user exists and meets the level requirement, let the request proceed
      next();
    } else {
      // None of the above, we need to error
      unauthorized(res);
    }
  };
}

module.exports.withAuthLevel = withAuthLevel;

// For testing purposes
module.exports.unauthorized = unauthorized;
module.exports.checkAuthLevel = checkAuthLevel;
