var crawlerStorage = require('./crawlerStorage');

// Heads up! This is magic. Don't care too much about it. It simply works.
var bencode = require('bencode'),
    dgram = require('dgram'),
    hat = require('hat'),
    _ = require('lodash');

// compact2string might throw an error, but we don't want this. It should return
// null instead.
var compact2string = function(compact) {
  try {
    return require('compact2string')(compact);
  } catch (e) {
    return null;
  }
};

// Implements parts of BEP 5 (http://www.bittorrent.org/beps/bep_0005.html).
// We currenly only need the get_peers functionality (requesting peers).
var DHT = function (options) {
  options = options || {};
  // We need to define a node ID for our DHT instance, since it interacts with
  // the BitTorrent DHT network as a regular client.
  this.nodeID = options.nodeID || hat(160);

  // during this._onMessage, we need to know if there are any peers left to crawl or not
  // We will toggle this variable from inside crawler.js at appropriate times
  this.needMorePeers = true;

  // Port 6881 works best.
  this.port = options.port || '6881';
  this.socket = dgram.createSocket('udp4');
  // Each get_peers request has a unique transaction ID, which is the key of a
  // key-value pair stored in getPeersCallback. The value is the callback
  // function that will be called as soon as we receive a response.
  this.getPeersCallbacks = {};
  // We need to keep track of transaction IDs, since they need to be unique keys
  // for our getPeersCallbacks object.
  this.nextTransactionID = 0;
  this.socket.on('message', this._onMessage.bind(this));
};

DHT.prototype.magicCallback = function (err, resp) {

_.each(resp.nodes, function (node) {
  // debugger;
  crawlerStorage.nodes[node] = _.now();
}, this);

_.each(resp.peers, function (peer) {
  crawlerStorage.peers[peer] = _.now();
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
// debugger;
// console.log(!!crawlerStorage.nodes[node]);
// console.log(_.keys(crawlerStorage.nodes).length + ' nodes');
// delete crawlerStorage.nodes[node];
// console.log(_.keys(crawlerStorage.nodes).length + ' nodes');
// console.log(!!crawlerStorage.nodes[node]);
};

// This function will be invoked as soon as a node sends a message.
DHT.prototype._onMessage = function (msg, rinfo) {
  msg = bencode.decode(msg);
  msg.t = Buffer.isBuffer(msg.t) && msg.t.length === 2 && msg.t.readUInt16BE(0);
  var callback = this.getPeersCallbacks[msg.t];
  if (callback) {
    var result = {};
    // peers have the torrent.
    result.peers = [];
    // nodes do not have the torrent, but are the nearest entries in the Hash
    // Table to it.
    result.nodes = [];
    // If this message contains peers
    if (msg.r && msg.r.values) {
      // console.log('----------------------------------- THERE ARE PEERS');
      result.peers = _.map(msg.r.values, compact2string);
    // If there are nodes, and there are no peers left to crawl
    }else if (msg.r && msg.r.nodes && Buffer.isBuffer(msg.r.nodes) && this.needMorePeers) {
      // console.log('THERE ARE NODES -----------------------------------');
      for (var i = 0; i < msg.r.nodes.length; i += 26) {
        result.nodes.push(compact2string(msg.r.nodes.slice(i + 20, i + 26)));
      }
    }
    // debugger;
    callback(null, result);
  }
};

// Starts the DHT client by listening on the specified port.
DHT.prototype.start = function (callback) {
  callback = callback || function () {  };
  this.socket.bind(this.port, function (exception) {
    callback.call(this, exception);
  }.bind(this));
};

DHT.prototype._transactionIdToBuffer = function (transactionId) {
  var buf = new Buffer(2);
  buf.writeUInt16BE(transactionId, 0);
  return buf;
};

DHT.prototype._idToBuffer = function (id) {
  return new Buffer(id, 'hex');
};

// Sends the get_peers request to a node.
DHT.prototype.getPeers = function (infoHash, address, callback) {
  callback = callback || function () {  };

  // if nextTransactionId gets too big, the buffer will exceed its maximum range
  if(this.nextTransactionID > 50000) {
    this.nextTransactionID = 0;
  }
  var transactionID = this.nextTransactionID++;

  var message = bencode.encode({

    //BitTorrent protocol assumes this object has these properties. Single letter styling 
    // is required by the protocol
    // y set to q means it's a query
    // q indicates the kind of query
    // a are the named arguments to the query
    t: this._transactionIdToBuffer(transactionID),
    y: 'q',
    q: 'get_peers',
    a: {
      id: this._idToBuffer(this.nodeID),
      info_hash: this._idToBuffer(infoHash)
    }
  });

  this.socket.send(message, 0, message.length, address.split(':')[1], address.split(':')[0], function (exception) {
    this.getPeersCallbacks[transactionID] = callback;
    setTimeout(function () {
      delete this.getPeersCallbacks[transactionID];
      // Deletes "itself" from the getPeersCallbacks object if we didn't receive
      // an answer within the next 1000 ms
    }.bind(this), 1000);
  }.bind(this));
};

// See crawler.js for usage example.
module.exports = exports = DHT;
