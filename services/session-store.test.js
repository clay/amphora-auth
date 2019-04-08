'use strict';

process.env.REDIS_DB = 'cool-db-name';

const _startCase = require('lodash/startCase'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`);

describe(_startCase(filename), function () {
  describe('createSessionStore', function () {
    let fakeSession;

    beforeEach(function () {
      fakeSession = jest.fn();

      lib.setSession(fakeSession);
    });

    it('should create a session with a new redisStore', function () {
      lib();

      expect(fakeSession).toBeCalled();
    });

    it('should create a session with an existing redisStore', function () {
      const mockStore = {
        setMaxListeners: jest.fn()
      };

      lib(mockStore);

      expect(fakeSession).toBeCalled();
    });
  });
});
