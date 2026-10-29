'use strict';

const handlebars = require('handlebars'),
  utils = require('../utils');

/**
 * Creates the login page template.
 * @returns {Handlebars.Template}
 */
function compileLoginPage() {
  const tpl = utils.compileTemplate('login.handlebars'),
    icons = ['clay-logo', 'twitter', 'google', 'slack', 'ldap', 'logout', 'cognito'];

  // add svgs to handlebars
  icons.forEach(icon => {
    handlebars.registerPartial(icon, utils.compileTemplate(`${icon}.svg`));
  });

  return tpl;
}

module.exports.compileLoginPage = compileLoginPage;
