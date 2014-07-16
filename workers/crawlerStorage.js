var _ = require('lodash');

var CrawlerStorage = function () {
  var timestamp = _.now();
  this.nodes = {
    'router.bittorrent.com:6881': timestamp,
    'router.utorrent.com:6881': timestamp,
    'dht.transmissionbt.com:6881': timestamp
  };
  this.peers = {};
};

module.exports = exports = new CrawlerStorage();