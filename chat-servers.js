var config = require('./config.json'),
    request = require('request'),
    dns = require('dns'),
    async = require('async');

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

var parseServers = function(res, callback) {
  var uniqueHosts = [];
  var servers = [];

  async.each(['servers', 'websockets_servers'], function(type, callback) {
    if(!res[type]) return callback();

    async.each(res[type], function(server, callback) {
      var subServers = [];

      async.waterfall([
        function(callback) {
          var host = server.split(':')[0];
          var port = parseInt(server.split(':')[1]);

          if(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host)) {
            subServers.push({
              host: host,
              port: port
            });
            return callback();
          }

          dns.lookup(host, {
            all: true
          }, function(err, hosts) {
            if(err) return callback();

            subServers = subServers.concat(hosts.map(function(h) {
              return {
                host: h.address,
                port: port
              };
            }));

            callback();
          });
        },
        function(callback) {
          subServers.forEach(function(server) {
            if(server.port === 6667) {
              subServers.push({
                host: server.host,
                port: 6697
              });
            } else if(server.port === 80) {
              subServers.push({
                host: server.host,
                port: 443
              });
            }
          });
          subServers.forEach(function(server) {
            var hostPort = server.host + ':' + server.port;

            if(uniqueHosts.indexOf(hostPort) > -1) return;
            uniqueHosts.push(hostPort);

            servers.push({
              name: hostPort,
              type: "chat",
              cluster: res.cluster,
              protocol: type === "websockets_servers" ? "ws_irc" : "irc",
              description: res.cluster !== "aws" ? res.cluster.capitalize() + " Chat Server" : "Chat Server",
              host: server.host,
              port: server.port,
              secure: [443, 6697].indexOf(server.port) > -1
            });
          });

          callback();
        }
      ], callback);
    }, callback);
  }, function() {
    callback(servers);
  });
}

var chatServers = function(callback) {
  request({
    url: "https://tmi.twitch.tv/servers",
    qs: {
      channel: config.irc.username,
      kappa: Math.random()
    },
    json: true,
    timeout: 60000
  }, function(error, response, data) {
    if(error || response.statusCode !== 200 || data.cluster !== 'aws') {
      callback(servers);
      return;
    }

    parseServers(data, function(newServers) {
      callback(newServers);
    });
  });
}

module.exports = function(callback) {
  chatServers(function(servers) {
    servers.sort(function(a, b) {
      return a.port - b.port || a.host.localeCompare(b.host);
    });

    callback(servers);
  });
}