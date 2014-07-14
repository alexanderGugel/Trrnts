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
  // this.nodes = {
  //   'router.bittorrent.com:6881': timestamp,
  //   'router.utorrent.com:6881': timestamp,
  //   'dht.transmissionbt.com:6881': timestamp
  // };
  this.nodes = [
    'router.bittorrent.com:6881',
    'router.utorrent.com:6881',
    'dht.transmissionbt.com:6881'
  ];
  this.peers = {};
};



//if there are peers


Crawler.prototype.catalogPeers = function(resp) {
  _.each(resp.peers, function (peer) {
    this.peers[peer] = _.now();

    //add peers to redis set
    redis.SADD('peer', peer);

    //store each peer in a sorted set for its magnet. We will score each magnet by
    //seeing how many peers there are for the magnet in the last X minutes
    redis.ZADD('magnets:' + infoHash + ':peers', _.now(), peer);
    // Store all peers to the geoQueue       
    // this.pushPeersToGeoQueue(resp.peers, infoHash);    
  }, this);
};

Crawler.prototype.crawlPeer = function (tStamp, peer){
  this.dht.getPeers(infoHash, peer, function (err, resp) {
    var numberOfPeersThisCrawl = _.keys(resp.peers).length;


    if(numberOfPeersThisCrawl > 0) {
      this.catalogPeers(resp);
    }


  }.bind(this));

};

Crawler.prototype.crawlNode = function (node) {
  console.log('Crawler.crawlNode, node -----------------------------------' + node);
  this.dht.getPeers(infoHash, node, function (err, resp) {
    if(err) {
      console.log('ERROR' + err);
    }
    var numberOfPeersThisCrawl = _.keys(this.peers).length;
    var numberOfNodesThisCrawl = _.keys(this.nodes).length;
    console.log('crawlNode numberOfPeersThisCrawl -----------------------------------' + numberOfPeersThisCrawl);
    console.log('crawlNode numberOfNodesThisCrawl -----------------------------------' + numberOfNodesThisCrawl);

    if(numberOfPeersThisCrawl > 0) {
      console.log('MONEY ----------------------------------- !!!!!!!!');
    } else if(numberOfNodesThisCrawl > 0) {
      _.each(resp.nodes, function (node) {
        console.log('node -----------------------------------' + node);
        this.nodes.push(node);
      }, this);
    }

    this.crawl(infoHash);

  }.bind(this));
};

Crawler.prototype.crawl = function (infoHash) {
  var numberOfNodes = _.keys(this.nodes).length;
  var numberOfPeers = _.keys(this.peers).length;

  if(numberOfPeers === 0 && numberOfNodes === 0) {
    console.log(' NO MORE PEERS OR NODES -----------------------------------');
  }

  if(numberOfPeers > 0) {
    console.log('crawl inside if -----------------------------------');
    _.each(this.peers, this.crawlPeer, this);
  } else {
    console.log('crawl inside else -----------------------------------');
    // _.each(this.nodes, this.crawlNode, this);
    console.log(this.nodes);
    this.crawlNode(this.nodes.pop()); 
  }


  // _.each(this.nodes, function (tStamp, node) {
  //   // console.log('----------------------------------- INSIDE CRAWL');
  // }, this);

  // this.crawl(infoHash);

  console.log(numberOfNodes + ' nodes');
  console.log(numberOfPeers + ' peers');
};

// Recursively crawls the BitTorrent DHT protocol using an instance of the DHT
// class, which is a property of the instance of the crawler.
// Crawler.prototype.crawl = function (infoHash) {
//   var numberOfNodes = _.keys(this.nodes).length;
//   var numberOfPeers = _.keys(this.peers).length;

//   _.each(this.nodes, function (tStamp, node) {
//     // console.log('----------------------------------- INSIDE CRAWL');
//     this.dht.getPeers(infoHash, node, function (err, resp) {

//       _.each(resp.nodes, function (node) {

//         this.nodes[node] = _.now();
//         //add nodes to redis set
//         redis.SADD('node', node);
//       }, this);

//       _.each(resp.peers, function (peer) {
//         this.peers[peer] = _.now();

//         //add peers to redis set
//         redis.SADD('peer', peer);

//         //store each peer in a sorted set for its magnet. We will score each magnet by
//         //seeing how many peers there are for the magnet in the last X minutes
//         redis.ZADD('magnets:' + infoHash + ':peers', _.now(), peer);
//         // redis.ZREVRANGE('magnets:' + infoHash + ':peers', 0, 0, 'withscores', function(err, resp) {
//         //   console.log('----------------------------------- ' + resp);
//         // });                      
//       }, this);

//       // Store all peers to the geoQueue       
//       // this.pushPeersToGeoQueue(resp.peers, infoHash);    
//     }.bind(this));
//   }, this);

//   setTimeout(function () {
//     this.crawl(infoHash);
//   }.bind(this), 100);

//   console.log(numberOfNodes + ' nodes');
//   console.log(numberOfPeers + ' peers');
// };

Crawler.prototype.start = function (callback) {
  this.dht.start(callback);
};

Crawler.prototype.pushPeersToGeoQueue = function (peers, infoHash, callback) {
  if (!peers.length || infoHash === undefined) {        
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
