'use strict';

module.exports.SECRET = process.env.CLAY_SESSION_SECRET || 'clay';
module.exports.AUTH_LEVELS = {
  ADMIN: 'admin',
  WRITE: 'write',
};
module.exports.MAINTENANCE_MODE_ENABLED = Boolean(process.env.MAINTENANCE_MODE_ENABLED);
