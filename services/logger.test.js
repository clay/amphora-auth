'use strict';

const _startCase = require('lodash/startCase'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`),
  clayLog = require('clay-log');

jest.mock('clay-log');

describe(_startCase(filename), function () {
  let fakeLog;

  beforeEach(function () {
    fakeLog = jest.fn();
  });

  describe('init', function () {
    const fn = lib[this.description];

    it('should initialize if no log instance is set', function () {
      fn();
      expect(clayLog.init).toBeCalled();
    });

    it('returns undefined if a log instance is set', function () {
      lib.setLogger(fakeLog);
      fn();
      expect(clayLog.init).not.toBeCalled();
    });
  });

  describe('setup', function () {
    const fn = lib[this.description];

    it('should set meta properties to clay log', function () {
      fn();
      expect(clayLog.meta).toBeCalled();
    });
  });
});
