'use strict';

const { describe, it } = require('node:test'),
  assert = require('node:assert/strict'),
  basicAuth = require('./basic-auth'),
  encoded = text => Buffer.from(text).toString('base64'),
  request = authorization => ({ headers: { authorization } });

describe('basic-auth', () => {
  it('reads the user and the password', () => {
    assert.deepEqual(basicAuth(request(`Basic ${encoded('user:pass')}`)), { name: 'user', pass: 'pass' });
  });

  it('does not mind the case of the scheme or spaces around the credentials', () => {
    assert.deepEqual(basicAuth(request(`basic ${encoded('u:p')}`)), { name: 'u', pass: 'p' });
    assert.deepEqual(basicAuth(request(` BASIC  ${encoded('u:p')}  `)), { name: 'u', pass: 'p' });
  });

  it('splits at the first colon only', () => {
    assert.deepEqual(basicAuth(request(`Basic ${encoded('a:b:c')}`)), { name: 'a', pass: 'b:c' });
    assert.deepEqual(basicAuth(request(`Basic ${encoded(':p')}`)), { name: '', pass: 'p' });
    assert.deepEqual(basicAuth(request(`Basic ${encoded('u:')}`)), { name: 'u', pass: '' });
  });

  it('reads utf-8', () => {
    assert.deepEqual(basicAuth(request(`Basic ${encoded('jörg:密码')}`)), { name: 'jörg', pass: '密码' });
  });

  it('gives undefined for anything that is not Basic credentials', () => {
    [undefined, null, '', 'Basic', 'Basic ', 'Bearer abc', `Basic ${encoded('nocolon')}`, 'Basic !!!', 5, {}].forEach(header => {
      assert.equal(basicAuth(request(header)), undefined, String(header));
    });
  });

  it('parses a header on its own', () => {
    assert.deepEqual(basicAuth.parse(`Basic ${encoded('u:p')}`), { name: 'u', pass: 'p' });
    assert.equal(basicAuth.parse(undefined), undefined);
  });

  it('wants a request with headers', () => {
    assert.throws(() => basicAuth(), { name: 'TypeError', message: 'argument req is required' });
    assert.throws(() => basicAuth('str'), { message: 'argument req is required to be an object' });
    assert.throws(() => basicAuth({}), { message: 'argument req is required to have headers property' });
  });
});
