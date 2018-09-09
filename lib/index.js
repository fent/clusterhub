const cluster = require('cluster');
const Hub     = require('./hub');


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
 * hub. But it cannot be used to communicate with all the other hubs.
 */
const globalHub = new Hub();
globalHub.Hub = Hub;
globalHub.createHub = (id) => new Hub(id);

module.exports = globalHub;


// Expose cluster.
globalHub.isMaster = cluster.isMaster;
globalHub.isWorker = cluster.isWorker;
globalHub.fork = cluster.fork;
