'use strict';

// Parses a Basic Authorization header. Same rules as the basic-auth package (2.0.1) this replaces:
// credentials = "Basic" 1*SP token68, user-pass = userid ":" password

const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/,
  USER_PASS_REGEXP = /^([^:]*):(.*)$/;

/**
 * parse the value of an Authorization header
 * @param {string} string
 * @returns {{name: string, pass: string}|undefined}
 */
function parse(string) {
  if (typeof string !== 'string') {
    return undefined;
  }

  const match = CREDENTIALS_REGEXP.exec(string),
    userPass = match && USER_PASS_REGEXP.exec(Buffer.from(match[1], 'base64').toString());

  return userPass ? { name: userPass[1], pass: userPass[2] } : undefined;
}

/**
 * read the credentials out of a request
 * @param {object} req
 * @returns {{name: string, pass: string}|undefined}
 */
function auth(req) {
  if (!req) {
    throw new TypeError('argument req is required');
  }

  if (typeof req !== 'object') {
    throw new TypeError('argument req is required to be an object');
  }

  if (!req.headers || typeof req.headers !== 'object') {
    throw new TypeError('argument req is required to have headers property');
  }

  return parse(req.headers.authorization);
}

module.exports = auth;
module.exports.parse = parse;
