'use strict';

const responses = require('../services/responses'),
  { AUTH_LEVELS } = require('../constants'),
  controller = require('../controllers/users'),
  { withAuthLevel } = require('../services/auth'),

  /**
   * All routes go here.
   *
   * They will all have the form (req, res), but never with next()
   *
   * @namespace
   */
  route = {
    /**
     * Add an user and tell the bus
     * @param {object} req
     * @param {object} res
     */
    createUser(req, res) {
      responses.expectJSON(() => controller.createUser(req.body), res);
    },

    /**
     * Remove the user and tell the bus
     * @param {Object} req
     * @param {Object} res
     * @returns {Promise}
     */
    deleteUser(req, res) {
      return responses.expectJSON(() => controller.deleteUser(req.uri), res);
    }
  };

/**
 * We want to trim the everything before /users/ out of
 * the request uri when trying to interact directly with
 * one existing user from any site.
 *
 * @param  {Object} req
 * @param  {Object} res
 * @param  {Function} next
 */
function trimToUserKey(req, res, next) {
  req.uri = req.uri.substring(req.uri.indexOf('/_users/'));
  next();
}

function routes(router) {
  router.use(responses.varyWithoutExtension({ varyBy: ['Accept'] }));

  // list users
  router.all('/', responses.methodNotAllowed({ allow: ['get', 'post'] }));
  router.all('/', responses.notAcceptable({ accept: ['application/json'] }));
  router.get('/', responses.listUsers());

  // create new user
  router.post('/', responses.denyReferenceAtRoot);
  router.post('/', withAuthLevel(AUTH_LEVELS.ADMIN));
  router.post('/', route.createUser);

  // get and update users
  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({ allow: ['get', 'put', 'delete'] }));
  router.all('/:name', responses.denyTrailingSlashOnId);
  router.use('/:name', trimToUserKey);
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', withAuthLevel(AUTH_LEVELS.ADMIN));
  router.put('/:name', route.createUser);
  router.delete('/:id', withAuthLevel(AUTH_LEVELS.ADMIN));
  router.delete('/:id', route.deleteUser);
}

module.exports = routes;
