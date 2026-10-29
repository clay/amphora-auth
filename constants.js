'use strict';

module.exports.SECRET = process.env.CLAY_SESSION_SECRET || 'clay';
module.exports.AUTH_LEVELS = {
  ADMIN: 'admin',
  WRITE: 'write',
};
module.exports.MAINTENANCE_MODE_ENABLED = Boolean(process.env.MAINTENANCE_MODE_ENABLED);
// passport 0.6 and later start a new session (with a new id) when someone signs in or out. That is off unless this
// is "true", so a session keeps its id the way it did with passport 0.3. Turn it on to get the new session id.
module.exports.REGENERATE_SESSION = process.env.CLAY_SESSION_REGENERATE === 'true';
