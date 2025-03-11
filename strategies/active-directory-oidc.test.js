'use strict';

const _startCase = require('lodash/startCase'),
  _includes = require('lodash/includes'),
  passport = require('passport'),
  filename = __filename.split('/').pop().split('.').shift(),
  utils = require('../utils'),
  db = require('../services/storage'),
  lib = require(`./${filename}`);

describe(_startCase(filename), function () {
  describe('verifyOIDC', function () {
    const fn = lib[this.description];

    it('calls verify with a slightly different function signature', function (done) {
      utils.verify = jest.fn(() => (req, token, tokenSecret, profile, cb) => cb()) // eslint-disable-line
      db.get = jest.fn().mockResolvedValue({ username: 'foo' });
      const profile = { _json: { preferred_username: 'foo' }};
      fn()({}, 'foo', 'bar', profile, function () {
        expect(utils.verify).toBeCalled();
        done();
      });
    });
  });

  describe('createActiveDirectoryOIDCStrategy', function () {
    const siteStub = { slug: 'foo' };

    it('creates active directory OIDC strategy', function () {
      passport.use = jest.fn();

      process.env.AD_OIDC_IDENTITY_METADATA = 'https://foo.com';
      process.env.AD_OIDC_CLIENT_ID = 'abc123';
      process.env.AD_OIDC_CONSUMER_CLIENT = '456';
      process.env.AD_OIDC_RESPONSE_MODE = 'form_post';
      process.env.AD_OIDC_RESPONSE_TYPE = 'id_token';
      process.env.AD_OIDC_REDIRECT_URL = 'https://redirect.com';
      lib(siteStub);

      expect(passport.use).toBeCalled();
    });
  });

  describe('createActiveDirectoryOIDCStrategy with scope', function () {
    const siteStub = { slug: 'foo' };

    it('creates active directory OIDC strategy', function () {
      passport.use = jest.fn();

      process.env.AD_OIDC_IDENTITY_METADATA = 'https://foo.com';
      process.env.AD_OIDC_CLIENT_ID = 'abc123';
      process.env.AD_OIDC_CONSUMER_CLIENT = '456';
      process.env.AD_OIDC_RESPONSE_MODE = 'form_post';
      process.env.AD_OIDC_RESPONSE_TYPE = 'id_token';
      process.env.AD_OIDC_REDIRECT_URL = 'https://redirect.com';
      process.env.AD_OIDC_SCOPE = 'test1,test2';
      lib(siteStub);

      expect(passport.use).toBeCalled();
    });
  });

  describe('addAuthRoutes', function () {
    const fn = lib[this.description],
      paths = [],
      router = {
        get: function (path) {
          // testing if the paths are added,
          // we're checking the paths array after each test
          paths.push(path);
	},
	post: function(path) {
          paths.push(path);
	},
        use: jest.fn(),
      };

    it('adds active directory OIDC auth and callback routes', function () {
      fn(router, {}, 'adoidc');
      expect(_includes(paths, '/_auth/adoidc')).toEqual(true);
      expect(_includes(paths, '/_auth/adoidc/callback')).toEqual(true);
    });
  });
});
