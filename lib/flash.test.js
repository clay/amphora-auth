'use strict';

const { describe, it } = require('node:test'),
  assert = require('node:assert/strict'),
  flash = require('./flash'),
  setup = (session = {}) => {
    const req = { session },
      res = { locals: {}, render() {} };

    flash()(req, res, () => {});
    return { req, res };
  };

describe('flash', () => {
  it('adds a message and says how many there are of that type', () => {
    const { req } = setup();

    assert.equal(req.flash('error', 'a'), 1);
    assert.equal(req.flash('error', 'b'), 2);
    assert.equal(req.flash('info', 'c'), 1);
  });

  it('gives the messages of a type, once', () => {
    const { req } = setup();

    req.flash('error', 'a');
    req.flash('error', 'b');
    assert.deepEqual(req.flash('error'), ['a', 'b']);
    assert.deepEqual(req.flash('error'), []);
  });

  it('gives all the messages, once', () => {
    const { req } = setup();

    req.flash('error', 'a');
    req.flash('info', 'b');
    assert.deepEqual(req.flash(), { error: ['a'], info: ['b'] });
    assert.deepEqual(req.flash(), {});
  });

  it('adds an array of messages', () => {
    const { req } = setup();

    assert.equal(req.flash('info', ['x', 'y']), 2);
    assert.deepEqual(req.flash('info'), ['x', 'y']);
  });

  it('formats a message', () => {
    const { req } = setup();

    req.flash('error', 'Invalid %s %d', 'thing', 5);
    assert.deepEqual(req.flash('error'), ['Invalid thing 5']);
  });

  it('keeps the messages in the session, where the next request finds them', () => {
    const session = {},
      first = setup(session),
      second = setup(session);

    first.req.flash('error', 'a');
    assert.deepEqual(session, { flash: { error: ['a'] } });
    assert.deepEqual(second.req.flash('error'), ['a']);
  });

  it('needs a session', () => {
    const { req } = setup();

    delete req.session;
    assert.throws(() => req.flash('error', 'a'), { message: 'req.flash() requires sessions' });
  });

  it('leaves a flash function that is already there', () => {
    const own = () => 'mine',
      req = { session: {}, flash: own };

    flash()(req, { locals: {} }, () => {});
    assert.equal(req.flash, own);
  });

  it('puts the messages in res.locals.messages when something is rendered', () => {
    const rendered = [],
      req = { session: {} },
      res = { locals: {}, render: (...args) => rendered.push(args) };

    flash()(req, res, () => {});
    req.flash('error', 'a');
    res.render('view', { x: 1 });
    assert.deepEqual(res.locals.messages, { error: ['a'] });
    assert.deepEqual(rendered, [['view', { x: 1 }]]);
    assert.deepEqual(req.flash(), {});
  });

  it('calls next', () => {
    let called = 0;

    flash()({ session: {} }, { locals: {} }, () => called++);
    assert.equal(called, 1);
  });
});
