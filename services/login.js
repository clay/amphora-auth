'use strict';

const _each = require('lodash/each'),
  handlebars = require('handlebars'),
  utils = require('../utils');

/**
 * Creates the login page template.
 * @returns {Handlebars.Template}
 */
function compileLoginPage() {
  const tpl = utils.compileTemplate('login.handlebars'),
    icons = ['clay-logo', 'twitter', 'google', 'slack', 'ldap', 'logout', 'cognito', 'active-directory'];

  // add svgs to handlebars
  _each(icons, icon => {
    handlebars.registerPartial(icon, utils.compileTemplate(`${icon}.svg`));
  });

  return tpl;
}

module.exports.compileLoginPage = compileLoginPage;
