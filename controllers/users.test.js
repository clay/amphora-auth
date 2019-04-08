'use strict';

const _startCase = require('lodash/startCase'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`),
  encrypt = require('../services/encrypt'),
  { encode } = require('../utils'),
  storage = require('../test/fixtures/mocks/storage');

describe(_startCase(filename), function () {
  let mockData = {
      username: 'foo',
      password: 'bar',
      provider: 'local',
      auth: 'admin',
    },
    fakeDb, fakeBus;

  beforeEach(function () {
    fakeDb = storage();

    fakeBus = {
      publish: jest.fn()
    };

    lib.setDb(fakeDb);
    lib.setBus(fakeBus);
  });

  describe('createUser', function () {
    const fn = lib[this.description];

    it('should throw if there is no data', function () {
      const cb = () => fn();

      expect(cb).toThrow();
    });

    it('should encrypt password if provided', function () {
      fakeDb.put.mockResolvedValue(mockData);
      encrypt.hashPassword = jest.fn();

      return fn(mockData)
        .then(() => expect(encrypt.hashPassword).toHaveBeenCalled());
    });

    it('should create an user', function () {
      const uri = `/_users/${encode(mockData.username.toLowerCase(), mockData.provider)}`,
        expected = Object.assign(mockData, { _ref: uri });

      fakeDb.put.mockResolvedValue(expected);

      return fn(mockData)
        .then(result => {
          expect(fakeDb.put).toHaveBeenCalled();
          expect(result._ref).toBe(expected._ref);
          expect(fakeBus.publish).toBeCalledWith('saveUser', { key: uri, value: expected });
        });
    });
  });

  describe('deleteUser', function () {
    const fn = lib[this.description];

    it('should delete an user', function () {
      const expected = mockData,
        uri = `/_users/${encode(mockData.username.toLowerCase(), mockData.provider)}`;

      fakeDb.get.mockResolvedValue(expected);
      fakeDb.del.mockResolvedValue();

      return fn(uri)
        .then(result => {
          expect(fakeDb.get).toBeCalledWith(uri);
          expect(fakeDb.del).toBeCalledWith(uri);
          expect(fakeBus.publish).toBeCalledWith('deleteUser', { uri });
          expect(result).toEqual(expected);
        });
    });

    it('should not delete an user if no uri is passed', function () {
      fakeDb.get.mockRejectedValue();

      return fn()
        .catch(() => {
          expect(fakeDb.get).toBeCalledWith('');
          expect(fakeDb.del).not.toBeCalled();
        });
    });
  });
});
