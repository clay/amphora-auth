'use strict';

const _head = require('lodash/head'),
  _defaults = require('lodash/defaults'),
  _isFunction = require('lodash/isFunction'),
  _reduce = require('lodash/reduce'),
  promiseDefer = require('../../utils/defer'),
  jsonTransform = require('../../utils/json-transform');

class Storage {
  constructor() {
    this.inMem = require('levelup')('whatever', { db: require('memdown') });
    this.setup = jest.fn().mockResolvedValue();
    this.get = jest.fn();
    this.put = jest.fn();
    this.del = jest.fn();
    this.list = this.list;
    this.clearMem = this.clear;
    this.createReadStream = (ops) => this.inMem.createReadStream(ops);
    this.getLatestData = jest.fn();
  }

  /**
   * Use ES6 promises
   * @returns {Object}
   */
  defer() {
    const def = promiseDefer();

    def.apply = function (err, result) {
      if (err) {
        def.reject(err);
      } else {
        def.resolve(result);
      }
    };

    return def;
  }

  /**
   * Save to inMemDb
   * @param  {String} key
   * @param  {String} value
   * @return {Promise}
   */
  writeToInMem(key, value) {
    const deferred = this.defer();

    this.inMem.put(key, value, deferred.apply);
    return deferred.promise;
  }

  /**
   * Clear the Db
   * @return {Promise}
   */
  clear() {
    const errors = [],
      ops = [],
      deferred = this.defer();

    this.inMem.createReadStream({
      keys: true,
      fillCache: false,
      limit: -1
    })
      .on('data', data => ops.push({ type: 'del', key: data.key }))
      .on('error', error => errors.push(error))
      .on('end', () => {
        if (errors.length) {
          deferred.apply(_head(errors));
        } else {
          this.inMem.batch(ops, deferred.apply);
        }
      });

    return deferred.promise;
  }

  /**
   * Gets a stream of data from the db
   * @param {Object} options
   * @returns {stream.ReadableStream}
   */
  /* eslint-disable complexity */
  list(options = {}) {
    options = _defaults(options, {
      limit: -1,
      keys: true,
      values: true,
      fillCache: false,
      json: true
    });

    // The prefix option is a shortcut for a greaterThan and lessThan range.
    if (options.prefix) {
      // \x00 is the first possible alphanumeric character, and \xFF is the last
      options.gte = options.prefix + '\x00';
      options.lte = options.prefix + '\xff';
    }

    let readStream,
      transformOptions = {
        objectMode: options.values,
        isArray: options.isArray
      };

    // if keys but no values, or values but no keys, always return as array.
    if (options.keys && !options.values || !options.keys && options.values) {
      transformOptions.isArray = true;
    }

    readStream = this.inMem.createReadStream(options);

    if (_isFunction(options.transforms)) {
      options.transforms = options.transforms();
    }

    // apply all transforms
    if (options.transforms) {
      readStream = _reduce(options.transforms, function (readStream, transform) {
        return readStream.pipe(transform);
      }, readStream);
    }

    if (options.json) {
      readStream = readStream.pipe(jsonTransform(transformOptions));
    }

    return readStream;
  }
}

module.exports = () => new Storage();
