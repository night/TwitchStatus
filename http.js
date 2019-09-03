var request = require('request');
var config = require('./config.json');

var HTTP = function(main) {
  this.servers = main.servers;

  var _self = this;
  setInterval(function() {
    _self.checkStatus();
  }, 30000);
}

HTTP.prototype.checkStatus = function() {
  var servers = this.servers,
      t = 0;

  var _self = this;
  Object.keys(servers).forEach(function(name) {
    var server = servers[name];
    if(server.type === "chat") return;

    setTimeout(function() {
      _self.checkWebAddress.call(_self, server.name, server.host, server.port, server.path);
    }, t += 1000);
  });
}

HTTP.prototype.checkWebAddress = function(name, host, port, path) {
  var servers = this.servers,
      startTime = Date.now(),
      path = path || '/',
      url = "http" + ((port === 443) ? "s" : "") + "://" + host + ":" + port + path;

  request.get({
    url: url,
    qs: {
      kappa: Math.random()
    },
    headers: {
      'Client-ID': config.irc.client_id,
    },
    timeout: 30000
  }, function(err, res, body) {
    if(!err && res.statusCode === 200) {
      servers[name].lag = Date.now() - startTime;
      servers[name].status = "online";

      // I consider >= 3000 slow because of CDNs
      // 1935 is an ingest port, but some ingests are across the world
      if(servers[name].lag >= 3000 && port !== 1935) {
        servers[name].status = "slow";
      }
    } else {
      servers[name].lag = 999999;
      servers[name].status = "offline";
    }
  });
}

module.exports = HTTP;