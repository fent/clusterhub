const cluster = require('cluster');
const path    = require('path');


// Forks a new worker with istanbul test coverage.
module.exports = (file) => {
  file = path.join(__dirname, file);
  cluster.setupMaster(process.env.running_under_istanbul ? {
    exec: './node_modules/.bin/istanbul',
    args: [
      'cover', '--report', 'none', /*'--dir', `./coverage/each/${file}`,*/
      '--print', 'none', '--include-pid', file, '--'
    ].concat(process.argv.slice(2))
  } : { exec: file });
  return cluster.fork();
};
