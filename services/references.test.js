'use strict';

const { describe, it, afterEach } = require('node:test'),
  assert = require('node:assert/strict'),
  { uriToUrl } = require('./references'),
  port = process.env.PORT;

afterEach(() => {
  if (port === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = port;
  }
});

describe('references', () => {
  describe('uriToUrl', () => {
    it('converts without protocol and port', () => {
      delete process.env.PORT;
      assert.equal(uriToUrl('localhost'), 'http://localhost/');
    });

    it('converts given protocol and port', () => {
      assert.equal(uriToUrl('localhost', 'https', '3333'), 'https://localhost:3333/');
    });

    it('does not say the default port', () => {
      assert.equal(uriToUrl('localhost', 'http', '80'), 'http://localhost/');
      assert.equal(uriToUrl('localhost', 'https', '443'), 'https://localhost/');
      assert.equal(uriToUrl('localhost', 'https', 443), 'https://localhost/');
    });

    it('says a port that is not the default of the protocol', () => {
      assert.equal(uriToUrl('localhost', 'http', '443'), 'http://localhost:443/');
      assert.equal(uriToUrl('localhost', 'https', '80'), 'https://localhost:80/');
    });

    it('keeps the path of the uri, and the trailing slash', () => {
      delete process.env.PORT;
      assert.equal(uriToUrl('foo.com/sub'), 'http://foo.com/sub');
      assert.equal(uriToUrl('foo.com/sub/'), 'http://foo.com/sub/');
    });

    it('takes the port from the environment when none is given', () => {
      process.env.PORT = '3001';
      assert.equal(uriToUrl('localhost'), 'http://localhost:3001/');
      assert.equal(uriToUrl('localhost', 'http', '4000'), 'http://localhost:4000/');
    });

    it('leaves out the port the uri itself has', () => {
      delete process.env.PORT;
      assert.equal(uriToUrl('localhost:3001'), 'http://localhost/');
      assert.equal(uriToUrl('localhost:3001', 'http', '4000'), 'http://localhost:4000/');
    });

    it('works for https without a port', () => {
      delete process.env.PORT;
      assert.equal(uriToUrl('foo.com', 'https'), 'https://foo.com/');
    });

    it('lower cases the host', () => {
      delete process.env.PORT;
      assert.equal(uriToUrl('FOO.com/Sub'), 'http://foo.com/Sub');
    });
  });
});
