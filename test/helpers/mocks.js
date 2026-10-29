'use strict';

const { Readable } = require('stream');

/**
 * a response that records what is done to it, in `calls`.
 * res.format() picks the formatter given here ('default' when none is)
 * @param {string} [formatter]
 * @returns {object}
 */
function createRes(formatter) {
  const res = { calls: [], locals: {}, headers: {} };

  ['status', 'type', 'set', 'send', 'json', 'sendStatus', 'redirect', 'end', 'setHeader'].forEach(method => {
    res[method] = (...args) => {
      res.calls.push([method, ...args]);
      return res;
    };
  });

  res.format = formatters => {
    res.calls.push(['format', Object.keys(formatters).sort().join(',')]);
    formatters[formatter || 'default']();
    return res;
  };

  return res;
}

/**
 * the storage amphora passes in, on a Map: get, put, del and list (a stream of keys by prefix, run through
 * the transforms, as a JSON array)
 * @param {object} [entries] key -> value (objects are stored as JSON)
 * @returns {object}
 */
function createStorage(entries = {}) {
  const data = new Map(Object.entries(entries).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));

  return {
    data,
    get: id => data.has(id) ? Promise.resolve(JSON.parse(data.get(id))) : Promise.reject(Object.assign(new Error('not found'), { name: 'NotFoundError' })),
    put: (id, value) => {
      data.set(id, typeof value === 'string' ? value : JSON.stringify(value));
      return Promise.resolve();
    },
    del: id => {
      data.delete(id);
      return Promise.resolve();
    },
    list: (options = {}) => {
      let stream = Readable.from([...data.keys()].filter(key => key.startsWith(options.prefix || '')).sort());
      const out = new Readable({ read() {} });
      let first = true;

      (options.transforms ? options.transforms() : []).forEach(transform => {
        stream = stream.pipe(transform);
      });
      stream.on('data', chunk => {
        out.push(`${first ? '[' : ','}"${chunk}"`);
        first = false;
      });
      stream.on('end', () => {
        out.push(first ? '[]' : ']');
        out.push(null);
      });
      return out;
    }
  };
}

/**
 * wait for a stream to end and give back what it wrote
 * @param {object} res a stream to write to (http response like)
 * @returns {Promise<string>}
 */
function collect(res) {
  const chunks = [];

  return new Promise((resolve, reject) => {
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks.map(c => Buffer.from(c))).toString()));
    res.on('error', reject);
  });
}

module.exports.createRes = createRes;
module.exports.createStorage = createStorage;
module.exports.collect = collect;
