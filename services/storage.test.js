'use strict';

const _startCase = require('lodash/startCase'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`),
  storage = require('../test/fixtures/mocks/storage');

describe(_startCase(filename), function () {
  let fakeDb;

  beforeEach(function () {
    fakeDb = storage();

    lib.setDb(fakeDb);
  });

  describe('get', function () {
    const fn = lib[this.description];

    it('calls the get method from the db service', function () {
      fakeDb.get.mockResolvedValue({ id: 'foo', username: 'Pizza', provider: 'google' });

      return fn('foo').then(data => {
        expect(fakeDb.get).toHaveBeenCalledWith('foo');
        expect(data.username).toBe('Pizza');
      });
    });
  });

  describe('put', function () {
    const fn = lib[this.description];

    it('calls the update method from the db service', function () {
      const data = {
        username: 'Pizza',
        provider: 'local',
      };

      fakeDb.put.mockResolvedValue(data);

      return fn('foo', data).then(result => {
        expect(fakeDb.put).toHaveBeenCalledWith('foo', data);
        expect(result.provider).toBe('local');
      });
    });
  });

  describe('del', function () {
    const fn = lib[this.description];

    it('calls the delete method from the db service', function () {
      fakeDb.del.mockResolvedValue();

      return fn('foo').then(() => {
        expect(fakeDb.del).toHaveBeenCalledWith('foo');
      });
    });
  });

  describe('list', function () {
    const fn = lib[this.description];

    it('calls the list method from the db service', function () {
      fakeDb.list = jest.fn().mockResolvedValue();

      return fn().then(() => {
        expect(fakeDb.list).toHaveBeenCalledWith({});
      });
    });
  });
});
