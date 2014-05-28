var config = require('./config.json'),
    request = require('request');

var chatServers = function(servers, callback) {
  var port6667Hosts = ["199.9.253.199", "199.9.253.210", "199.9.250.229", "199.9.250.239"];

  request({
    url: "https://api.twitch.tv/api/channels/"+config.irc.username+"/chat_properties",
    json: true,
    timeout: 10000
  }, function(error, response, data) {
    if(error || !data.chat_servers || data.eventchat || data.devchat) {
      callback(servers);
      return;
    }

    data.chat_servers.forEach(function(server) {
      var host = server.split(':')[0],
          port = parseInt(server.split(':')[1]);

      servers.push({
        name: host+":"+port,
        type: "chat",
        description: "Chat Server",
        host: host,
        port: port
      });
    });

    port6667Hosts.forEach(function(host) {
      for(var i=0; i<servers.length; i++) {
        var server = servers[i];

        if(server.host === host) {
          servers.push({
            name: host+":"+6667,
            type: "chat",
            description: "Chat Server",
            host: host,
            port: 6667
          });
          break;
        }
      }
    });

    callback(servers);
  });
}

var eventChatServers = function(servers, callback) {
  request({
    url: "https://api.twitch.tv/api/channels/riotgames/chat_properties",
    json: true,
    timeout: 10000
  }, function(error, response, data) {
    if(error || !data.chat_servers || !data.eventchat || data.devchat) {
      callback(servers);
      return;
    }

    data.chat_servers.forEach(function(server) {
      var host = server.split(':')[0],
          port = parseInt(server.split(':')[1]);

      servers.push({
        name: host+":"+port,
        type: "chat",
        description: "Event Chat Server",
        host: host,
        port: port
      });
    });

    callback(servers);
  });
}

var groupChatServers = function(servers, callback) {
  request({
    url: "https://chatdepot.twitch.tv/room_memberships?oauth_token="+config.irc.access_token,
    json: true,
    timeout: 10000
  }, function(error, response, data) {
    if(error || !data.memberships || data.memberships.length === 0) {
      callback(servers);
      return;
    }

    data.memberships[0].room.servers.forEach(function(server) {
      var host = server.split(':')[0],
          port = parseInt(server.split(':')[1]);

      servers.push({
        name: host+":"+port,
        type: "chat",
        description: "Group Chat Server",
        host: host,
        port: port
      });
    });

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