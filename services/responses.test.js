'use strict';

const { describe, it, beforeEach } = require('node:test'),
  assert = require('node:assert/strict'),
  { createRes, createStorage } = require('../test/helpers/mocks'),
  { Writable } = require('stream'),
  responses = require('./responses'),
  tick = () => new Promise(resolve => setImmediate(resolve)),
  jsonBody = (code, message) => [['status', code], ['format', 'default,html,json,text'], ['json', { message, code }]];

describe('responses', () => {
  let logs;

  beforeEach(() => {
    logs = [];
    responses.setLog((...args) => logs.push(args));
  });

  describe('handleError', () => {
    it('answers 404 for a "not found" and does not log it', () => {
      const res = createRes('json');

      responses.handleError(res)(new Error('not found'));
      assert.deepEqual(res.calls, jsonBody(404, 'not found'));
      assert.deepEqual(logs, []);
    });

    it('answers 404 for ENOENT, and for NotFoundError', () => {
      const a = createRes('json'),
        b = createRes('json');

      responses.handleError(a)(new Error('ENOENT: no such file'));
      responses.handleError(b)(Object.assign(new Error('x'), { name: 'NotFoundError' }));
      assert.deepEqual(a.calls, jsonBody(404, 'ENOENT: no such file'));
      assert.deepEqual(b.calls, jsonBody(404, 'x'));
    });

    it('answers with the status of the error, when it has one', () => {
      const res = createRes('json');

      responses.handleError(res)(Object.assign(new Error('forbidden'), { status: 403 }));
      assert.deepEqual(res.calls, jsonBody(403, 'forbidden'));
      assert.deepEqual(logs, []);
    });

    it('answers 404 for a NotFoundError even if it has a status', () => {
      const res = createRes('json');

      responses.handleError(res)(Object.assign(new Error('gone'), { status: 500, name: 'NotFoundError' }));
      assert.deepEqual(res.calls, jsonBody(404, 'gone'));
    });

    it('answers 400 and logs when the message says it is the client', () => {
      const res = createRes('json'),
        error = new Error('something Client');

      responses.handleError(res)(error);
      assert.deepEqual(res.calls, jsonBody(400, 'something Client'));
      assert.deepEqual(logs, [['error', 'something Client', { error }]]);
    });

    it('answers 500 and logs the error otherwise', () => {
      const res = createRes('json'),
        error = new Error('boom');

      responses.handleError(res)(error);
      assert.deepEqual(res.calls, jsonBody(500, 'boom'));
      assert.deepEqual(logs, [['error', 'boom', { error }]]);
    });

    it('answers 500 for something that is not an Error', () => {
      [undefined, null, 'a string', {}, 42].forEach(thrown => {
        const res = createRes('json');

        responses.handleError(res)(thrown);
        assert.equal(res.calls[0][1], 500, String(thrown));
      });
      assert.equal(logs.length, 5);
      assert.equal(logs[2][1], 'a string');
    });

    it('answers in the format that was asked for', () => {
      const error = new Error('boom'),
        html = createRes('html'),
        text = createRes('text'),
        other = createRes('default');

      responses.handleError(html)(error);
      responses.handleError(text)(error);
      responses.handleError(other)(error);
      assert.deepEqual(html.calls.slice(2), [['type', 'html'], ['send', '500 boom']]);
      assert.deepEqual(text.calls.slice(2), [['type', 'text'], ['send', '500 boom']]);
      assert.deepEqual(other.calls.slice(2), [['sendStatus', 500]]);
    });
  });

  describe('clientError and serverError', () => {
    it('log the error under the error key and say 400 and 500', () => {
      const client = createRes('json'),
        server = createRes('json'),
        error = new Error('x');

      responses.clientError(error, client);
      responses.serverError(error, server);
      assert.deepEqual(client.calls, jsonBody(400, 'x'));
      assert.deepEqual(server.calls, jsonBody(500, 'x'));
      assert.deepEqual(logs, [['error', 'x', { error }], ['error', 'x', { error }]]);
    });

    it('give a message to log and to answer when the error has none', () => {
      const client = createRes('json'),
        server = createRes('json');

      responses.clientError(new Error(''), client);
      responses.serverError(new Error(''), server);
      assert.equal(logs[0][1], 'Client Error');
      assert.equal(logs[1][1], 'Server Error');
      assert.deepEqual(server.calls, jsonBody(500, 'Server Error'));
    });

    it('take what comes after a colon as the message to the client', () => {
      const res = createRes('json');

      responses.clientError(new Error('Client: the part to show'), res);
      assert.deepEqual(res.calls, jsonBody(400, 'the part to show'));
    });
  });

  describe('expectJSON', () => {
    it('sends what the function gives', async () => {
      const a = createRes('json'),
        b = createRes('json');

      responses.expectJSON(() => ({ a: 1 }), a);
      responses.expectJSON(() => Promise.resolve({ b: 2 }), b);
      await tick();
      assert.deepEqual(a.calls, [['json', { a: 1 }]]);
      assert.deepEqual(b.calls, [['json', { b: 2 }]]);
    });

    it('runs the function at once', () => {
      let ran = false;

      responses.expectJSON(() => { ran = true; }, createRes('json'));
      assert.equal(ran, true);
    });

    it('answers an error that is thrown, or rejected', async () => {
      const thrown = createRes('json'),
        rejected = createRes('json');

      responses.expectJSON(() => { throw new Error('not found'); }, thrown);
      responses.expectJSON(() => Promise.reject(new Error('db down')), rejected);
      await tick();
      assert.deepEqual(thrown.calls, jsonBody(404, 'not found'));
      assert.deepEqual(rejected.calls, jsonBody(500, 'db down'));
    });

    it('answers something that is thrown or rejected that is not an Error', async () => {
      const a = createRes('json'),
        b = createRes('json'),
        c = createRes('json');

      responses.expectJSON(() => Promise.reject('str'), a);
      responses.expectJSON(() => Promise.reject(), b);
      responses.expectJSON(() => { throw 'x'; }, c); // eslint-disable-line no-throw-literal
      await tick();
      assert.deepEqual([a, b, c].map(res => res.calls[0]), [['status', 500], ['status', 500], ['status', 500]]);
    });
  });

  describe('varyWithoutExtension', () => {
    it('adds Vary when the path has no extension', () => {
      const res = createRes(),
        calls = [];

      responses.varyWithoutExtension({ varyBy: ['Accept', 'X'] })({ baseUrl: '/foo', path: '/hey' }, res, () => calls.push('next'));
      assert.deepEqual(res.calls, [['set', 'Vary', 'Accept, X']]);
      assert.deepEqual(calls, ['next']);
    });

    it('does not when it has one', () => {
      const res = createRes();

      responses.varyWithoutExtension({ varyBy: ['Accept'] })({ baseUrl: '/foo', path: '/hey.html' }, res, () => {});
      assert.deepEqual(res.calls, []);
    });
  });

  describe('methodNotAllowed', () => {
    it('lets an allowed method through, in any case', () => {
      const calls = [];

      responses.methodNotAllowed({ allow: ['get', 'post'] })({ method: 'GET' }, createRes(), () => calls.push('GET'));
      responses.methodNotAllowed({ allow: ['get', 'post'] })({ method: 'post' }, createRes(), () => calls.push('post'));
      assert.deepEqual(calls, ['GET', 'post']);
    });

    it('answers 405 with what is allowed otherwise', () => {
      const res = createRes('json'),
        calls = [];

      responses.methodNotAllowed({ allow: ['get', 'post'] })({ method: 'PATCH' }, res, () => calls.push('next'));
      assert.deepEqual(calls, []);
      assert.deepEqual(res.calls, [['set', 'Allow', 'GET, POST'], ['status', 405], ['format', 'default,html,json,text'], ['json', { allow: ['get', 'post'], message: 'Method PATCH not allowed', code: 405 }]]);
    });
  });

  describe('notAcceptable and acceptJSONOnly', () => {
    it('let through what is acceptable', () => {
      const calls = [];

      responses.notAcceptable({ accept: ['application/json'] })({ accepts: () => 'application/json' }, createRes(), () => calls.push('a'));
      responses.acceptJSONOnly({ accepts: () => 'json' }, createRes(), () => calls.push('b'));
      assert.deepEqual(calls, ['a', 'b']);
    });

    it('answer 406 for what is not', () => {
      const a = createRes('json'),
        b = createRes('json');

      responses.notAcceptable({ accept: ['application/json'] })({ accepts: () => false, get: () => 'text/xml' }, a, () => assert.fail('next'));
      responses.acceptJSONOnly({ accepts: () => false, get: () => 'text/xml' }, b, () => assert.fail('next'));
      assert.deepEqual(a.calls[0], ['set', 'Accept', 'application/json']);
      assert.deepEqual(a.calls.slice(1), [['status', 406], ['format', 'default,html,json,text'], ['json', { accept: ['application/json'], message: 'text/xml not acceptable', code: 406 }]]);
      assert.equal(b.calls[1][1], 406);
    });
  });

  describe('denyReferenceAtRoot', () => {
    it('answers 400 for a _ref at the root of the body', () => {
      const res = createRes('json');

      responses.denyReferenceAtRoot({ body: { _ref: 'x' } }, res, () => assert.fail('next'));
      assert.deepEqual(res.calls, jsonBody(400, 'Reference (_ref) at root of object is not acceptable'));
    });

    it('goes on otherwise', () => {
      const calls = [];

      [{}, { a: { _ref: 1 } }, undefined, null, 'str', []].forEach(body => responses.denyReferenceAtRoot({ body }, createRes(), () => calls.push('next')));
      assert.equal(calls.length, 6);
    });
  });

  describe('denyTrailingSlashOnId', () => {
    it('answers 400 for a slash at the end', () => {
      const res = createRes('json');

      responses.denyTrailingSlashOnId({ path: '/foo/' }, res, () => assert.fail('next'));
      assert.deepEqual(res.calls, jsonBody(400, 'Trailing slash on RESTful id in URL is not acceptable'));
    });

    it('goes on otherwise', () => {
      const calls = [];

      ['/foo', '', '/a/b'].forEach(path => responses.denyTrailingSlashOnId({ path }, createRes(), () => calls.push('next')));
      assert.equal(calls.length, 3);
    });
  });

  describe('getRouteFromDB', () => {
    it('sends the user without the password', async () => {
      const res = createRes('json');

      responses.setDb(createStorage({ '/_users/a': { username: 'a', password: 'hash', auth: 'admin' } }));
      responses.getRouteFromDB({ uri: '/_users/a' }, res);
      await tick();
      assert.deepEqual(res.calls, [['json', { username: 'a', auth: 'admin' }]]);
    });

    it('answers 404 for a user that is not there', async () => {
      const res = createRes('json');

      responses.setDb(createStorage());
      responses.getRouteFromDB({ uri: '/_users/nope' }, res);
      await tick();
      assert.deepEqual(res.calls, jsonBody(404, 'not found'));
    });
  });

  describe('listUsers', () => {
    const response = () => {
      const chunks = [],
        res = new Writable({ write(chunk, encoding, cb) { chunks.push(chunk.toString()); cb(); } });

      res.set = (...args) => chunks.headers = (chunks.headers || []).concat([args]);
      res.chunks = chunks;
      return res;
    };

    beforeEach(() => {
      responses.setDb(createStorage({ '/_users/a': {}, '/_users/aa': {}, '/_users/c': {}, '/other/z': {} }));
    });

    it('lists the users, under the host', async () => {
      const res = response(),
        finished = new Promise(resolve => res.on('finish', resolve));

      responses.listUsers()({ hostname: 'base.com', baseUrl: '', path: '/_users/' }, res);
      await finished;
      assert.deepEqual(JSON.parse(res.chunks.join('')), ['base.com/_users/a', 'base.com/_users/aa', 'base.com/_users/c']);
      assert.deepEqual(res.chunks.headers, [['Content-Type', 'application/json']]);
    });

    it('lists them under the path of the site', async () => {
      const res = response(),
        finished = new Promise(resolve => res.on('finish', resolve));

      responses.listUsers()({ hostname: 'base.com', baseUrl: '', path: '/some/path/_users/' }, res);
      await finished;
      assert.deepEqual(JSON.parse(res.chunks.join('')), ['base.com/some/path/_users/a', 'base.com/some/path/_users/aa', 'base.com/some/path/_users/c']);
    });

    it('can be given other options', async () => {
      const res = response(),
        finished = new Promise(resolve => res.on('finish', resolve));

      responses.listUsers({ prefix: '/other/' })({ hostname: 'h', baseUrl: '', path: '/_users/' }, res);
      await finished;
      assert.deepEqual(JSON.parse(res.chunks.join('')), ['h/other/z']);
    });
  });
});
