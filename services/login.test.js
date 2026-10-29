'use strict';

const { describe, it, mock } = require('node:test'),
  assert = require('node:assert/strict'),
  handlebars = require('handlebars'),
  utils = require('../utils'),
  { compileLoginPage } = require('./login');

describe('login', () => {
  describe('compileLoginPage', () => {
    it('gives a template that renders the login page', () => {
      const html = compileLoginPage()({ currentProviders: [{ name: 'google', url: '/_auth/google', title: 'Log in with Google', icon: () => 'google' }], flash: { error: ['<b>Invalid Password</b>'] } });

      assert.match(html, /<title>Log In - Clay<\/title>/);
      assert.match(html, /<h1 class="header">Log in to Clay<\/h1>/);
      assert.match(html, /<a class="button google" href="\/_auth\/google" title="Log in with Google">/);
      assert.match(html, /<svg/); // the google icon, from a partial
      assert.match(html, /&lt;b&gt;Invalid Password&lt;\/b&gt;/); // the flash message, escaped
    });

    it('registers the icons as partials', () => {
      compileLoginPage();
      ['clay-logo', 'twitter', 'google', 'slack', 'ldap', 'logout', 'cognito'].forEach(icon => {
        assert.equal(typeof handlebars.partials[icon], 'function', icon);
      });
    });

    it('reads and compiles the templates once, however often it is called', () => {
      const compile = mock.method(utils, 'compileTemplate');

      compileLoginPage();
      compileLoginPage();
      compileLoginPage();
      assert.equal(compile.mock.callCount(), 0); // all of them were compiled by the tests above
      compile.mock.restore();
    });

    it('registers the partials every time, in case something else replaced them', () => {
      compileLoginPage();
      handlebars.registerPartial('google', 'replaced');
      compileLoginPage();
      assert.notEqual(handlebars.partials.google, 'replaced');
    });
  });
});
