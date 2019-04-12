'use strict';

const _assign = require('lodash/assign'),
  _has = require('lodash/has'),
  _includes = require('lodash/includes'),
  _last = require('lodash/last'),
  _omit = require('lodash/omit'),
  bluebird = require('bluebird'),
  map = require('through2-map'),
  { removePrefix, getUri } = require('../utils'),
  omitProperties = ['password'],
  STATUS_CODE_ERROR = 400;
let db = require('./storage'),
  log = require('./logger').setup({
    file: __filename
  });

/**
 * Reusable code to return JSON data, both for good results AND errors.
 *
 * Captures and hides appropriate errors.
 *
 * These return JSON always, because these endpoints are JSON-only.
 * @param {function} fn
 * @param {object} res
 */
function expectJSON(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.json(result);
  }).catch(handleError(res));
}

/**
 * Handle errors in the standard/generic way
 * @param {object} res
 * @returns {function}
 */
function handleError(res) {
  return function (err) {
    if (err.status && err.name !== 'NotFoundError') {
      // If we're in this block, the error has a defined `status` property and
      // the error should be directed out immediately
      sendDefaultResponseForCode(err.status, err.message, res);
    } else if (err.name === 'NotFoundError' ||
      err.message.indexOf('ENOENT') !== -1 ||
      err.message.indexOf('not found') !== -1) {
      notFound(err, res);
      // if the word "client" is ever in a message, it should be for the client. We enforce that here.
    } else if (err.message.indexOf('Client') !== -1) {
      clientError(err, res);
    } else {
      serverError(err, res);
    }
  };
}

/**
 * Sends a response with the desired format and status code.
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @param {object} extras
 */
function sendDefaultResponseForCode(code, message, res, extras) {
  res.status(code).format({
    json: sendJSONErrorCode(code, message, res, extras),
    html: sendHTMLErrorCode(code, message, res),
    text: sendTextErrorCode(code, message, res),
    default: sendDefaultErrorCode(code, res)
  });
}

/**
 * Send whatever is default for this type of data with this status code.
 * @param {number} code
 * @param {object} res
 * @returns {function}
 */
function sendDefaultErrorCode(code, res) {
  return function () {
    res.sendStatus(code);
  };
}

/**
 * Send some html (should probably be some default, or a render of a 500 page)
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @returns {function}
 */
function sendHTMLErrorCode(code, message, res) {
  return function () {
    res.type('html');
    res.send(`${code} ${message}`);
  };
}

/**
 * Sends a default JSON message
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @param {object} extras
 * @returns {function}
 */
function sendJSONErrorCode(code, message, res, extras) {
  return function () {
    res.json(_assign({ message, code }, extras));
  };
}

/**
 * Sends a default text message
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @returns {function}
 */
function sendTextErrorCode(code, message, res) {
  return function () {
    res.type('text');
    res.send(`${code} ${message}`);
  };
}

/**
 * All "Not Found" errors are routed like this.
 * @param {Error} [err]
 * @param {object} res
 */
function notFound(err, res) {
  const message = err.message || 'Not Found',
    code = 404;

  // hide error from user of api.
  sendDefaultResponseForCode(code, message, res);
}

/**
 * All client errors should look like this.
 * @param {Error} err
 * @param {object} res
 */
function clientError(err, res) {
  log('error', err.message, { stack: err.stack });

  // They know it's a 400 already, we don't need to repeat the fact that its an error.
  const message = removePrefix(err.message, ':'),
    code = STATUS_CODE_ERROR;

  sendDefaultResponseForCode(code, message, res);
}

/**
 * All server errors should look like this.
 *
 * In general, 500s represent a _developer mistake_.  We should try to replace them with more descriptive errors.
 * @param {Error} err
 * @param {object} res
 */
function serverError(err, res) {
  // error is required to be logged
  log('error', err.message, { stack: err.stack });

  const message = err.message || 'Server Error', // completely hide these messages from outside
    code = 500;

  sendDefaultResponseForCode(code, message, res);
}

/**
 * Sets Vary header
 * @param {{varyBy: [string]}} options
 * @returns {function}
 */
function varyWithoutExtension(options) {
  const varyBy = options.varyBy.join(', ');

  return function (req, res, next) {
    // a slash, followed by a dot, followed by more characters, means it is an extension
    // note that this is explicitly not talking about a uri; Law of Demeter
    if (!(req.baseUrl + req.path).match(/.*\/.*\.(.*)/)) {
      res.set('Vary', varyBy);
    }

    next();
  };
}

/**
 * Middleware to restrict HTTP Methods in a route
 * @param {Object} options
 * @param {string[]} options.allow
 * @returns {function}
 */
function methodNotAllowed(options) {
  const allowed = options.allow;

  return function (req, res, next) {
    let message, code,
      method = req.method;

    if (_includes(allowed, method.toLowerCase())) {
      next();
    } else {
      code = 405;
      message = `Method ${method} not allowed`;
      res.set('Allow', allowed.join(', ').toUpperCase());
      sendDefaultResponseForCode(code, message, res, options);
    }
  };
}

/**
 * Middleware to restrict Content Types in a route.
 * @param {Object} options
 * @param {string[]} options.accept
 * @returns {function}
 */
function notAcceptable(options) {
  const acceptableTypes = options.accept;

  return function (req, res, next) {
    let message, code,
      matchedType = req.accepts(acceptableTypes);

    if (matchedType) {
      next();
    } else {
      code = 406;
      message = `${req.get('Accept')} not acceptable`;
      res.set('Accept', acceptableTypes.join(', ').toLowerCase());
      sendDefaultResponseForCode(code, message, res, options);
    }
  };
}

/**
 * List all users things in the db
 * @param {object} [options]
 * @param {string} [options.prefix]
 * @param {boolean} [options.values]
 * @param {function|array} [options.transforms]
 * @returns {function}
 */
function listUsers(options) {
  return function (req, res) {
    const usersString = '/_users/',
      listOptions = _assign({
        prefix: usersString,
        values: false,
        transforms() {
          return [map({ wantStrings: true }, function (str) {
            // We're going to construct base uri from the `getUri`
            // function, but that will include `/_users` so we want
            // to strip that out and then we're good
            return `${getUri(req).replace(usersString, '')}${str}`;
          })];
        }
      }, options),
      list = db.list(listOptions);

    res.set('Content-Type', 'application/json');
    list.pipe(res);
  };
}

/**
 * This route not allowed
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 */
function denyReferenceAtRoot(req, res, next) {
  const { body } = req;

  if (_has(body, '_ref')) {
    sendDefaultResponseForCode(STATUS_CODE_ERROR, 'Reference (_ref) at root of object is not acceptable', res);
  } else {
    next();
  }
}

/**
 * Validates that requests accepts json data
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function acceptJSONOnly(req, res, next) {
  if (req.accepts('json')) {
    next();
  } else {
    notAcceptable({accept: ['application/json']})(req, res, next);
  }
}

/**
 * Sends an error if the URI Id has trailing slash
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function denyTrailingSlashOnId(req, res, next) {
  if (_last(req.path) === '/') {
    sendDefaultResponseForCode(STATUS_CODE_ERROR, 'Trailing slash on RESTful id in URL is not acceptable', res);
  } else {
    next();
  }
}

/**
 * This route gets straight from the db.
 * @param {object} req
 * @param {object} res
 */
function getRouteFromDB(req, res) {
  expectJSON(() => {
    return db.get(req.uri)
      .then(users => _omit(users, omitProperties));
  }, res);
}

module.exports.expectJSON = expectJSON;
module.exports.varyWithoutExtension = varyWithoutExtension;
module.exports.methodNotAllowed = methodNotAllowed;
module.exports.listUsers = listUsers;
module.exports.denyReferenceAtRoot = denyReferenceAtRoot;
module.exports.acceptJSONOnly = acceptJSONOnly;
module.exports.denyTrailingSlashOnId = denyTrailingSlashOnId;
module.exports.getRouteFromDB = getRouteFromDB;
module.exports.notAcceptable = notAcceptable;

// For testing purposes
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
module.exports.handleError = handleError;
module.exports.clientError = clientError;
module.exports.serverError = serverError;
module.exports.sendTextErrorCode = sendTextErrorCode;
module.exports.notFound = notFound;
module.exports.sendHTMLErrorCode = sendHTMLErrorCode;
module.exports.sendJSONErrorCode = sendJSONErrorCode;
