const cluster = require('cluster');
const path    = require('path');


// Forks a new worker with istanbul test coverage.
module.exports = (filename) => {
  const filepath = path.join(__dirname, filename);
  cluster.setupMaster(process.env.running_under_istanbul ? {
    exec: './node_modules/.bin/istanbul',
    args: [
      'cover', '--report', 'json',
      '--dir', `./coverage/each/workers/${filename}`,
      '--print', 'none', '--include-pid', filepath, '--'
    ].concat(process.argv.slice(2))
  } : { exec: filepath });
  return cluster.fork();
};
