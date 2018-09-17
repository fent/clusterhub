const cluster = require('cluster');
const Hub     = require('./hub');
const hubs    = require('./globals').hubs;
const onReady = require('./globals').onReady;


/**
 * Require fork.js to overwrite cluster.fork()
 */
if (cluster.isMaster) {
  require('./fork');
} else {
  require('./listener');
}

/**
 * Export an intance of a hub. This can be used if the clusterhub user
 * doesn't wanna bother creating a new hub. It will be considered the global
 * hub.
 */
const globalHub = module.exports = new Hub();
globalHub.Hub = Hub;
globalHub.createHub = (id) => hubs.has(id) ? hubs.get(id) : new Hub(id);
globalHub.ready = onReady;
