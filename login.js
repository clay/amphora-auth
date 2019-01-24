'use strict';

const _each = require('lodash/each'),
  handlebars = require('handlebars'),
  { compileTemplate } = require('./utils');

/**
 * Creates the login page template.
 * @returns {Handlebars.Template}
 */
function compileLoginPage() {
  const tpl = compileTemplate('login.handlebars'),
    icons = ['clay-logo', 'twitter', 'google', 'slack', 'ldap', 'logout'];

  // add svgs to handlebars
  _each(icons, icon => {
    handlebars.registerPartial(icon, compileTemplate(`${icon}.svg`));
  });

  return tpl;
}

module.exports.compileLoginPage = compileLoginPage;
