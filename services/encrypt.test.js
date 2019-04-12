'use strict';

const _startCase = require('lodash/startCase'),
  bcrypt = require('bcryptjs'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`);

describe(_startCase(filename), function () {
  describe('hashPassword', function () {
    const fn = lib[this.description];

    it('should create a hash given a password', function () {
      bcrypt.hashSync = jest.fn().mockReturnValue('foo123bar456');
      bcrypt.genSaltSync = jest.fn().mockReturnValue('r4nd0ms41th4sh');

      const result = fn('foobar');

      expect(bcrypt.hashSync).toHaveBeenCalledWith('foobar', 'r4nd0ms41th4sh');
      expect(result).toBe('foo123bar456');
    });

    it('should throw an error if no password if passed', function () {
      bcrypt.hashSync = jest.fn().mockImplementation(() => { throw new Error(); });
      const cb = () => fn();

      expect(cb).toThrow();
    });
  });

  describe('isValidPassword', function () {
    const fn = lib[this.description];

    it('should return true if valid password', function () {
      bcrypt.compareSync = jest.fn().mockReturnValue(true);

      const user = { password: 'foo123bar456' },
        result = fn(user, 'foobar');

      expect(bcrypt.compareSync).toHaveBeenCalledWith('foobar', user.password);
      expect(result).toBeTruthy();
    });

    it('should return false if invalid password', function () {
      bcrypt.compareSync = jest.fn().mockReturnValue(false);

      const user = { password: 'foo123bar456' },
        result = fn(user, 'foobaz');

      expect(bcrypt.compareSync).toHaveBeenCalledWith('foobaz', user.password);
      expect(result).toBeFalsy();
    });
  });
});
