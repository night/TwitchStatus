var config = require('./config.json'),
    request = require('request');

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

var parseServers = function(res) {
  var uniqueHosts = [];
  var servers = [];

  ['servers', 'websockets_servers'].forEach(function(type) {
    if(!res[type]) return servers;

    res[type].forEach(function(server) {
      var host = server.split(':')[0];
      var port = parseInt(server.split(':')[1]);

      if(uniqueHosts.indexOf(host + ':6667') === -1) {
        uniqueHosts.push(host + ':6667');
        servers.push({
          name: host + ":6667",
          type: "chat",
          cluster: res.cluster,
          protocol: "irc",
          description: res.cluster !== "main" ? res.cluster.capitalize() + " Chat Server" : "Chat Server",
          host: host,
          port: 6667
        });
      }

      if(uniqueHosts.indexOf(server) > -1) return;
      uniqueHosts.push(server);

      servers.push({
        name: host + ":" + port,
        type: "chat",
        cluster: res.cluster,
        protocol: type === "websockets_servers" ? "ws_irc" : "irc",
        description: res.cluster !== "main" ? res.cluster.capitalize() + " Chat Server" : "Chat Server",
        host: host,
        port: port
      });
    });
  });

  return servers;
}

var chatServers = function(servers, callback) {
  request({
    url: "https://tmi.twitch.tv/servers",
    qs: {
      channel: config.irc.username,
      kappa: Math.random()
    },
    json: true,
    timeout: 60000
  }, function(error, response, data) {
    if(error || response.statusCode !== 200 || data.cluster !== 'main') {
      callback(servers);
      return;
    }

    servers = servers.concat(parseServers(data));

    callback(servers);
  });
}

var eventChatServers = function(servers, callback) {
  request({
    url: "https://tmi.twitch.tv/servers",
    qs: {
      channel: 'riotgames',
      kappa: Math.random()
    },
    json: true,
    timeout: 60000
  }, function(error, response, data) {
    if(error || response.statusCode !== 200 || data.cluster !== 'event') {
      callback(servers);
      return;
    }

    servers = servers.concat(parseServers(data));

    callback(servers);
  });
}

var groupChatServers = function(servers, callback) {
  request({
    url: "https://tmi.twitch.tv/servers",
    qs: {
      cluster: 'group',
      kappa: Math.random()
    },
    json: true,
    timeout: 60000
  }, function(error, response, data) {
    if(error || response.statusCode !== 200 || data.cluster !== 'group') {
      callback(servers);
      return;
    }

    servers = servers.concat(parseServers(data));

    callback(servers);
  });
}

module.exports = function(callback) {
  chatServers([], function(servers) {
    eventChatServers(servers, function(servers) {
      groupChatServers(servers, function(servers) {
        servers.sort(function(a, b) {
          return a.port - b.port || a.host.localeCompare(b.host);
        });

        callback(servers);
      });
    });
  });
}