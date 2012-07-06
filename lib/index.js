var cluster = require('cluster')
  , Hub     = require('./hub')
  ;


/**
 * Require fork.js to overwrite cluster.fork()
 */
require('./fork');


/**
 * Export an intance of a hub. This can be used if the clusterhub user
 * doesn't wanna bother creating a new hub. It will be considered the global
 * hub. But it cannot be used to communicate with all the other hubs.
 */
var globalHub = new Hub();
globalHub.Hub = Hub;
globalHub.createHub = function(id) {
  return new Hub(id);
};

module.exports = globalHub;


// expose cluster
globalHub.isMaster = cluster.isMaster;
globalHub.isWorker = cluster.isWorker;
globalHub.fork = cluster.fork;
