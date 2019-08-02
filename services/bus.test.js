'use strict';

const _startCase = require('lodash/startCase'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`);

describe(_startCase(filename), function () {
  describe('publish', function () {
    const fakeBus = { publish: jest.fn() },
      fn = lib[this.description];

    lib.setBus(fakeBus);

    it('calls publish method from the bus service', () => {
      fakeBus.publish.mockResolvedValue();

      fn('save', {});

      expect(fakeBus.publish).toBeCalledWith('save', {});
    });
  });
});
