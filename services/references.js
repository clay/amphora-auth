'use strict';

/**
 * Take the protocol and port from a sourceUrl and apply them to some uri
 * @param {string} uri
 * @param {string} [protocol]
 * @param {string} [port]
 * @returns {string}
 */
function uriToUrl(uri, protocol, port) {
  // just pretend to start with http; it's overwritten on the next line
  const url = new URL(`http://${uri}`);

  url.protocol = protocol || 'http';
  // the port of the uri itself is dropped; the default port of the protocol is left out of the result
  url.port = port || process.env.PORT || '';

  return url.href;
}

module.exports.uriToUrl = uriToUrl;
