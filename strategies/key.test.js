'use strict';

const _startCase = require('lodash/startCase'),
  _includes = require('lodash/includes'),
  passport = require('passport'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`);

describe(_startCase(filename), function () {
  describe('apiCallback', function () {
    const fn = lib[this.description];

    it('allows api key that matches CLAY_ACCESS_KEY', function (done) {
      const oldKey = process.env.CLAY_ACCESS_KEY;

      process.env.CLAY_ACCESS_KEY = '123';
      fn('123', function (err, data) {
        expect(err).toEqual(null);
        expect(data).toEqual({ provider: 'apikey', auth: 'admin' });
        process.env.CLAY_ACCESS_KEY = oldKey;
        done();
      });
    });

    it('allows an api key that matches PREVIOUS_CLAY_ACCESS_KEY', function (done) {
      const oldKey = process.env.CLAY_ACCESS_KEY;
      const olderKey = process.env.PREVIOUS_CLAY_ACCESS_KEY;

      process.env.CLAY_ACCESS_KEY = '123';
      process.env.PREVIOUS_CLAY_ACCESS_KEY = '789';
      fn('789', function (err, data) {
        expect(err).toEqual(null);
        expect(data).toEqual({ provider: 'apikey', auth: 'admin' });
        process.env.CLAY_ACCESS_KEY = oldKey;
        process.env.PREVIOUS_CLAY_ACCESS_KEY = olderKey;
        done();
      });
    });

    it('disallows api key that does not match CLAY_ACCESS_KEY or PREVIOUS_CLAY_ACCESS_KEY', function (done) {
      const oldKey = process.env.CLAY_ACCESS_KEY;
      const olderKey = process.env.PREVIOUS_CLAY_ACCESS_KEY;

      process.env.CLAY_ACCESS_KEY = '123';
      process.env.PREVIOUS_CLAY_ACCESS_KEY = '789';
      fn('456', function (err, data, status) {
        expect(err).toEqual(null);
        expect(data).toEqual(false);
        expect(status.message).toEqual('Unknown apikey: 456');
        process.env.CLAY_ACCESS_KEY = oldKey;
        process.env.PREVIOUS_CLAY_ACCESS_KEY = olderKey;
        done();
      });
    });
  });

  describe('createAPIKeyStrategy', function () {
    it('creates apikey strategy', function () {
      passport.use = jest.fn();

      lib();

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
        }
      };

    it('adds apikey auth and callback routes', function () {
      fn(router, {}, 'apikey');
      expect(_includes(paths, '/_auth/apikey')).toEqual(true);
      expect(_includes(paths, '/_auth/apikey/callback')).toEqual(true);
    });
  });
});
