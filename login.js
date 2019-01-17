'use strict';

const _each = require('lodash/each'),
  fs = require('fs'),
  path = require('path'),
  handlebars = require('handlebars');

/**
 * compile a handlebars template
 * @param {string} filename
 * @returns {function}
 */
function compileTemplate(filename) {
  return handlebars.compile(fs.readFileSync(path.resolve(__dirname, '.', 'views', filename), { encoding: 'utf-8' }));
}

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
module.exports.compileTemplate = compileTemplate;
