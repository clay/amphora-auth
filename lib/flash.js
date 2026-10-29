'use strict';

// Flash messages stored in the session (req.session.flash), the same behavior as the express-flash 0.0.2
// and connect-flash packages this replaces:
//   req.flash('error', 'message')  adds a message and returns how many there are of that type
//   req.flash('error')             returns the messages of that type and clears them
//   req.flash()                    returns all of them and clears them
// and res.render() puts the messages in res.locals.messages first.

const { format } = require('util');

/**
 * add one message (or an array of them, or a formatted one) of a type
 * @param {object} msgs
 * @param {string} type
 * @param {Array} args everything that came after the type
 * @returns {number} how many messages there are of the type
 */
function addMessages(msgs, type, args) {
  let [msg] = args;

  if (args.length > 1) {
    msg = format(...args);
  } else if (Array.isArray(msg)) {
    msg.forEach(val => (msgs[type] = msgs[type] || []).push(val));
    return msgs[type].length;
  }

  return (msgs[type] = msgs[type] || []).push(msg);
}

/**
 * @param {string} [type]
 * @param {string|string[]} [msg]
 * @returns {number|string[]|object}
 */
function flash(type, msg) {
  if (this.session === undefined) {
    throw Error('req.flash() requires sessions');
  }

  const msgs = this.session.flash = this.session.flash || {};

  if (type && msg) {
    return addMessages(msgs, type, Array.prototype.slice.call(arguments, 1));
  } else if (type) {
    const arr = msgs[type];

    delete msgs[type];
    return arr || [];
  }

  this.session.flash = {};
  return msgs;
}

/**
 * @returns {function} express middleware
 */
function middleware() {
  return function (req, res, next) {
    if (!req.flash) {
      req.flash = flash;
    }

    // the flash is retrieved right before the render function is executed
    const render = res.render;

    res.render = function () {
      res.locals.messages = req.flash();
      render.apply(res, arguments);
    };
    next();
  };
}

module.exports = middleware;
module.exports.flash = flash;
