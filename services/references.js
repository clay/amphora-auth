'use strict';

const urlParse = require('url');

/**
 * Take the protocol and port from a sourceUrl and apply them to some uri
 * @param {string} uri
 * @param {string} [protocol]
 * @param {string} [port]
 * @returns {string}
 */
function uriToUrl(uri, protocol, port) {
  // just pretend to start with http; it's overwritten two lines down
  const parts = urlParse.parse(`http://${uri}`);

  parts.protocol = protocol || 'http';
  parts.port = port || process.env.PORT;
  delete parts.host;

  if (parts.port &&
    (parts.protocol === 'http' && parts.port.toString() === '80') ||
    parts.protocol === 'https' && parts.port.toString() === '443'
  ) {
    delete parts.port;
  }

  return parts.format();
}

module.exports.uriToUrl = uriToUrl;
