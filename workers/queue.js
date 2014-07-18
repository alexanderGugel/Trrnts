// See https://github.com/learnboost/kue for further reference.
var kue = require('kue'),
    redis = require('../redis');

// Instantiate a job queue using Kue which will help us handle multiple crawler
// jobs. Running more than a few at a time tends to explode the computers.
var queue = kue.createQueue({
  redis: {
    createClientFactory: function () {
      return redis();
    }
  }
});

process.once('SIGTERM', function (sig) {
  queue.shutdown(function (err) {
    if (err) {
      console.error('Error:' + err.message);
      console.error(err.stack);
    }
    console.log('Exiting now. Shutting down queue.');
    process.exit(0);
  }, 5000);
});

module.exports = exports = queue;