var DHT = require('./dht');
var redis = require('../redis.js');
var _ = require('lodash');

// Uses an DHT instance in order to crawl the network.
var Crawler = function () {
  this.dht = new DHT();
  var timestamp = _.now();
  // Addresses as keys, since we need constant time insert operations and unique
  // entries (inserts every node only once).
  // We need a few "bootstrap nodes" as entry points for getting started.
  this.nodes = {
    'router.bittorrent.com:6881': timestamp,
    'router.utorrent.com:6881': timestamp,
    'dht.transmissionbt.com:6881': timestamp
  };
  this.peers = {};
};

Crawler.prototype.crawlNode = function (infoHash) {
  _.each(this.nodes, function (tStamp, node) {
    this.dht.getPeers(infoHash, node, function (err, resp) {

      _.each(resp.nodes, function (node) {
        this.nodes[node] = _.now();
      }, this);

      _.each(resp.peers, function (peer) {
        this.peers[peer] = _.now();
        //add peers to redis set
        redis.SADD('peer', peer);

        //store each peer in a sorted set for its magnet. We will score each magnet by
        //seeing how many peers there are for the magnet in the last X minutes
        redis.ZADD('magnets:' + infoHash + ':peers', _.now(), peer);

        //use the code below if you want to console.log the contents of current infoHash's sorted set
        // redis.ZREVRANGE('magnets:' + infoHash + ':peers', 0, 0, 'withscores', function(err, resp) {
        //   console.log('----------------------------------- ' + resp);
        // });

        // // Store all peers to the geoQueue       
        // this.pushPeersToGeoQueue(resp.peers);
      }, this);
      console.log(!!this.nodes[node]);
      console.log(_.keys(this.nodes).length + ' nodes');
      delete this.nodes[node];
      console.log(_.keys(this.nodes).length + ' nodes');
      console.log(!!this.nodes[node]);
    }.bind(this));


  }, this);
};

Crawler.prototype.crawlPeers = function(infoHash) {

  _.each(this.peers, function (tStamp, peer) {
    this.dht.getPeers(infoHash, peer, function (err, resp) {

      _.each(resp.peers, function (peer) {
        this.peers[peer] = _.now();
        //add peers to redis set
        redis.SADD('peer', peer);

        //store each peer in a sorted set for its magnet. We will score each magnet by
        //seeing how many peers there are for the magnet in the last X minutes
        redis.ZADD('magnets:' + infoHash + ':peers', _.now(), peer);

        //use the code below if you want to console.log the contents of current infoHash's sorted set
        // redis.ZREVRANGE('magnets:' + infoHash + ':peers', 0, 0, 'withscores', function(err, resp) {
        //   console.log('----------------------------------- ' + resp);
        // });

        // // Store all peers to the geoQueue       
        // this.pushPeersToGeoQueue(resp.peers);
      }, this);
    }.bind(this));


  }, this);
}

// Recursively crawls the BitTorrent DHT protocol using an instance of the DHT
// class, which is a property of the instance of the crawler.
Crawler.prototype.crawl = function (infoHash) {

  var numberOfNodes = _.keys(this.nodes).length;
  var numberOfPeers = _.keys(this.peers).length;
  if(numberOfPeers === 0){
    this.crawlNode(infoHash); 
  } else {
    this.crawlPeers(infoHash);
 
  }

  //current implementation simply kicks the crawler off every 100ms. This is not sustainable
  //and will be fixed in the future.
  // Crawls every node every 100 ms, which is not efficient. We only want to
  // crawl the the new nodes/ peers. TODO
  setTimeout(function () {
    // console.log('----------------START-------------------');
    this.crawl(infoHash);
  }.bind(this), 1000);

  // console.log(numberOfNodes +  ' nodes');
  // console.log(numberOfPeers + ' peers');
};

Crawler.prototype.start = function (callback) {
  this.dht.start(callback);
};

Crawler.prototype.pushPeersToGeoQueue = function (peers) {
  if (!peers.length) {        
    return;
  }

  // slice in order to not modify resp.peers
  // var formattedPeers = peers.slice();
  
  // Each peer will have format ipAddress:port. 
  // geo:queue is needs to be first element because of .apply
  // formattedPeers.unshift('geo:queue');

  // redis.SADD.apply(null, formattedPeers);
};


var crawler = new Crawler();
//TODO: set infoHash based on user submitted magnet links
var infoHash = '7AE9924651F7E6A1E47C918C1256847DCA471BF9';

crawler.start(function () {
  crawler.crawl(infoHash, function (err, stats) {
  });
});
