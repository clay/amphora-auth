'use strict';

const handlebars = require('handlebars'),
  utils = require('../utils'),
  templates = new Map();

/**
 * Compiles a template from the views folder, once.
 * @param {string} filename
 * @returns {Handlebars.Template}
 */
function compiled(filename) {
  if (!templates.has(filename)) {
    templates.set(filename, utils.compileTemplate(filename));
  }

  return templates.get(filename);
}

/**
 * Creates the login page template.
 * @returns {Handlebars.Template}
 */
function compileLoginPage() {
  const tpl = compiled('login.handlebars'),
    icons = ['clay-logo', 'google', 'ldap', 'logout'];

  // add svgs to handlebars
  icons.forEach(icon => {
    handlebars.registerPartial(icon, compiled(`${icon}.svg`));
  });

  return tpl;
}

module.exports.compileLoginPage = compileLoginPage;
