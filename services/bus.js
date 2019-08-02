'use strict';

let bus; // Redis bus passed from Amphora. Assigned value at initialization

/**
 * Publishes an event to the bus.
 * @param {string} eventName
 * @param {Object} data
 */
function publish(eventName, data) {
  bus.publish(eventName, data);
}

module.exports.publish = publish;
module.exports.setBus = redisBus => bus = redisBus;
