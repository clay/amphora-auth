'use strict';
var mockUser, OLD_ACCESS_KEY;

jest.mock('../utils', () => {
  return {
    ...jest.requireActual('../utils'),
    fetchUserViaAPIKey: jest.fn().mockResolvedValue(mockUser)
  };
});

const _startCase = require('lodash/startCase'),
  _includes = require('lodash/includes'),
  bluebird = require('bluebird'),
  filename = __filename.split('/').pop().split('.').shift(),
  utils = require('../utils');

describe(_startCase(filename), function () {
  beforeAll(() => {
    OLD_ACCESS_KEY = process.env.CLAY_ACCESS_KEY;
  });

  beforeEach(() => {
    mockUser = null;
    process.env.CLAY_ACCESS_KEY = '123';
    jest.resetModules();
    utils.fetchUserViaAPIKey = jest.fn().mockResolvedValue(mockUser);
  });

  afterAll(() => {
    process.env.CLAY_ACCESS_KEY = OLD_ACCESS_KEY;
  });

  describe('apiCallback', function () {

    it('allows api key that matches CLAY_ACCESS_KEY', function (done) {
      const { apiCallback } = require(`./${filename}`);

      apiCallback('123', function (err, data) {
        expect(err).toEqual(null);
        expect(data).toEqual({ provider: 'apikey', auth: 'admin' });
        done();
      });
    });

    it('disallows api key that does not match CLAY_ACCESS_KEY', function (done) {
      const { apiCallback } = require(`./${filename}`);

      apiCallback('456', function (err, data, status) {
        expect(err).toEqual(null);
        expect(data).toEqual(false);
        expect(status.message).toEqual('Unknown apikey: 456');
        done();
      });
    });

    it('allows api key that matches user API key', function (done) {
      mockUser = { auth: 'admin' };
      const { apiCallback } = require(`./${filename}`);

      apiCallback('valid-user-key', function (err, data) {
        expect(err).toEqual(null);
        expect(data).toEqual({ ...mockUser, provider: 'apikey'});
        done();
      });
    });

    it('disallows api key that does not match user API key', function (done) {
      const { apiCallback } = require(`./${filename}`);

      apiCallback('456', function (err, data, status) {
        expect(err).toEqual(null);
        expect(data).toEqual(false);
        expect(status.message).toEqual('Unknown apikey: 456');
        done();
      });
    });

    it('disallows api key when CLAY_ACCESS_KEY is empty', function (done) {
      const { apiCallback } = require(`./${filename}`);

      process.env.CLAY_ACCESS_KEY = '';
      apiCallback('', function (err, data, status) {
        expect(err).toEqual(null);
        expect(data).toEqual(false);
        expect(status.message).toEqual('Unknown apikey: ');
        done();
      });
    });

    it('disallows api key when CLAY_ACCESS_KEY is not set', function (done) {
      const { apiCallback } = require(`./${filename}`);

      delete process.env.CLAY_ACCESS_KEY;
      apiCallback('undefined', function (err, data, status) {
        expect(err).toEqual(null);
        expect(data).toEqual(false);
        expect(status.message).toEqual('Unknown apikey: undefined');
        done();
      });
    });

  });

  describe('createAPIKeyStrategy', function () {
    it('creates apikey strategy', function () {
      const passport = require('passport');
      const lib = require(`./${filename}`);

      passport.use = jest.fn();
      lib();

      expect(passport.use).toBeCalled();
    });
  });

  describe('addAuthRoutes', function () {
    const { addAuthRoutes } = require(`./${filename}`);
    const paths = [];
    const router = {
      get: function (path) {
        // testing if the paths are added,
        // we're checking the paths array after each test
        paths.push(path);
      }
    };

    it('adds apikey auth and callback routes', function () {
      addAuthRoutes(router, {}, 'apikey');
      expect(_includes(paths, '/_auth/apikey')).toEqual(true);
      expect(_includes(paths, '/_auth/apikey/callback')).toEqual(true);
    });
  });
});
