'use strict';

// Small replacements for the few lodash functions this package used (lodash was never declared as a dependency).
// They keep lodash 4's rules for the inputs that reach them: provider profiles, session users and site config.

const hasOwn = Object.prototype.hasOwnProperty,
  reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
  reIsPlainProp = /^\w*$/,
  rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
  reEscapeChar = /\\(\\)?/g,
  pathCache = new Map();

/**
 * a path like 'emails[0].value' is a key of its own if the object has it as one
 * @param {*} value
 * @param {object} object
 * @returns {boolean}
 */
function isKey(value, object) {
  if (Array.isArray(value)) {
    return false;
  }

  if (value == null || ['number', 'boolean', 'symbol'].includes(typeof value)) {
    return true;
  }

  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
}

/**
 * @param {string} string
 * @returns {string[]}
 */
function stringToPath(string) {
  if (pathCache.has(string)) {
    return pathCache.get(string);
  }

  const result = parsePath(string);

  if (pathCache.size >= 500) { // the paths come from the strategies, so there are few. This is just in case
    pathCache.clear();
  }

  pathCache.set(string, result);
  return result;
}

/**
 * @param {string} string
 * @returns {string[]}
 */
function parsePath(string) {
  const result = [];

  if (string.charCodeAt(0) === 46) { // a leading dot
    result.push('');
  }

  string.replace(rePropName, (match, number, quote, subString) => {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : number || match);
  });
  return result;
}

/**
 * @param {*} key
 * @returns {string|symbol}
 */
function toKey(key) {
  if (typeof key === 'string' || typeof key === 'symbol') {
    return key;
  }

  return Object.is(key, -0) ? '-0' : `${key}`;
}

/**
 * @param {string|string[]} path
 * @param {object} object
 * @returns {Array}
 */
function toPath(path, object) {
  if (Array.isArray(path)) {
    return path;
  }

  return isKey(path, object) ? [path] : stringToPath(`${path}`);
}

/**
 * get a value by path ('a.b[0].c'), or the default when it resolves to undefined
 * @param {object} object
 * @param {string|string[]} path
 * @param {*} [defaultValue]
 * @returns {*}
 */
function get(object, path, defaultValue) {
  const keys = toPath(path, object);
  let index = 0,
    result = object;

  while (result != null && index < keys.length) {
    result = result[toKey(keys[index++])];
  }

  result = index && index === keys.length ? result : undefined;
  return result === undefined ? defaultValue : result;
}

/**
 * array-like values whose emptiness is their length (lodash's rule: arrays, strings, typed arrays, arguments...)
 * @param {*} value
 * @returns {boolean}
 */
function isLengthEmptiness(value) {
  return Number.isSafeInteger(value.length) && value.length >= 0 && typeof value !== 'function' &&
    (Array.isArray(value) || typeof value === 'string' || typeof value.splice === 'function' || ArrayBuffer.isView(value) ||
      Object.prototype.toString.call(value) === '[object Arguments]');
}

/**
 * true for null, undefined, empty arrays and strings, maps and sets, and objects without own enumerable keys
 * @param {*} value
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value == null) {
    return true;
  }

  if (isLengthEmptiness(value)) {
    return !value.length;
  }

  if (value instanceof Map || value instanceof Set) {
    return !value.size;
  }

  for (const key in value) {
    if (hasOwn.call(value, key)) {
      return false;
    }
  }

  return true;
}

/**
 * 'GOOGLE' -> 'Google'
 * @param {*} value
 * @returns {string}
 */
function capitalize(value) {
  const string = value == null ? '' : toKey(typeof value === 'symbol' ? String(value) : value).toLowerCase(),
    [first = ''] = string;

  return first.toUpperCase() + string.slice(first.length);
}

/**
 * fill in the properties of source that are undefined on object (in place, like lodash's defaults)
 * @param {object} object
 * @param {object} source
 * @returns {object}
 */
function defaults(object, source) {
  object = Object(object);

  for (const key in source) {
    const value = object[key];

    if (value === undefined || Object.is(value, Object.prototype[key]) && !hasOwn.call(object, key)) {
      object[key] = source[key];
    }
  }

  return object;
}

/**
 * includes for arrays and strings, false for anything else (including null and undefined)
 * @param {Array|string} collection
 * @param {*} value
 * @returns {boolean}
 */
function includes(collection, value) {
  return typeof collection === 'string' || Array.isArray(collection) ? collection.includes(value) : false;
}

/**
 * a shallow copy of an object without some keys (lodash's omit, for the flat keys used here)
 * @param {object} object
 * @param {string[]} keys
 * @returns {object}
 */
function omit(object, keys) {
  const result = {};

  if (object == null) {
    return result;
  }

  for (const key in object) {
    result[key] = object[key];
  }

  for (const symbol of Object.getOwnPropertySymbols(Object(object))) {
    if (Object.prototype.propertyIsEnumerable.call(object, symbol)) {
      result[symbol] = object[symbol];
    }
  }

  keys.forEach(key => delete result[key]);
  return result;
}

module.exports.get = get;
module.exports.isEmpty = isEmpty;
module.exports.capitalize = capitalize;
module.exports.defaults = defaults;
module.exports.includes = includes;
module.exports.omit = omit;
