'use strict';

const { describe, it, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  clayLog = require('clay-log'),
  logger = require('./logger');

describe('logger', () => {
  describe('init', () => {
    it('does not start another logger if there is one', () => {
      const init = mock.method(clayLog, 'init');

      logger.init();
      assert.equal(init.mock.callCount(), 0);
      init.mock.restore();
    });

    it('starts a logger named amphora, with the version, when there is none', () => {
      const init = mock.method(clayLog, 'init', () => {}),
        getLogger = mock.method(clayLog, 'getLogger', () => ({ child: () => 'child' }));

      logger.setLogger(undefined);
      logger.init();
      assert.equal(init.mock.callCount(), 1);
      assert.deepEqual(init.mock.calls[0].arguments[0], { name: 'amphora', meta: { amphoraVersion: require('../package.json').version } });
      assert.equal(getLogger.mock.callCount(), 1);
      init.mock.restore();
      getLogger.mock.restore();
    });
  });

  describe('setup', () => {
    it('gives a log function with the meta it was given', () => {
      const lines = [],
        instance = { child: meta => ({ error: (data, msg) => lines.push([meta, data, msg]) }) };

      logger.setLogger(instance);
      logger.setup({ file: 'somewhere.js' })('error', 'oh no', { error: new Error('x') });
      assert.equal(lines.length, 1);
      assert.deepEqual(lines[0][0], { file: 'somewhere.js' });
      assert.equal(lines[0][2], 'oh no');
      assert.equal(lines[0][1].error.message, 'x');
      assert.equal(lines[0][1]._label, 'ERROR');
    });

    it('needs some meta', () => {
      assert.throws(() => logger.setup({}), { message: /requires object argument/ });
    });
  });
});
