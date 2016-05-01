var config = require('./config.json'),
    tmi = require('./tmi-connection-handler');

var Chat = function(main) {
  this.db = main.db;
  this.storedReports = main.reports;
  this.storedLostMessages = main.lostMessages;
  this.servers = main.servers;

  this.connectionQueue = [];

  this.lostMessages = {};

  var _self = this;
  /*setInterval(function() {
    _self.updateStats();
  }, 30000);*/
  setInterval(function() {
    _self.pingChat();
  }, 10000);
  setInterval(function() {
    if(!_self.connectionQueue.length) return;
    var tmi = _self.connectionQueue.shift();
    tmi.connect();
  }, 500);
}

Chat.prototype.checkLostMessages = function(id) {
  var db = this.db,
      data = this.lostMessages[id];

  var receivers = Object.keys(data.receivers),
      receiversArray = [],
      received = 0,
      receivedFromSelf = 0;

  // Check if the message was seen by all the other chat servers
  receivers.forEach(function(name) {
    var receiver = data.receivers[name];

    if(receiver.received) {
      received++;
      if(name.split(':')[0] === data.origin.split(':')[0]) { // If same IP
        receivedFromSelf++;
      }
    }

    receiversArray.push({
      server: name,
      ip: name.split(':')[0],
      port: parseInt(name.split(':')[1]),
      received: receiver.received,
      time: new Date(receiver.time)
    });
  });

  var percentReceived = parseFloat(((received/receivers.length)*100).toFixed(2)),
      percentLost = parseFloat((100 - percentReceived).toFixed(2));

  // If the message was completely lost or if the receiver only received its own messages, then the server itself is having issues.
  if(percentLost === 100 || (receivers.length > 3 && received === receivedFromSelf)) {
    this.storedReports.push({ type: "chat", kind: "lines", server: data.origin, logged: new Date() });
    receiversArray.forEach(function(receiver) {
      if(receiver.received) {
        this.storedReports.push({ type: "chat", kind: "lines", server: receiver.server, logged: new Date() });
      }
    }.bind(this));
  } else {
    receiversArray.forEach(function(receiver) {
      if(!receiver.received) {
        this.storedReports.push({ type: "chat", kind: "lines", server: receiver.server, logged: new Date() });
      }
    }.bind(this));
  }

  if(percentLost > 0) {
    this.storedLostMessages.push({ origin: { server: data.origin, ip: data.origin.split(':')[0], port: parseInt(data.origin.split(':')[1]) }, sent: new Date(data.sent), percentLost: percentLost, percentReceived: percentReceived, receivers: receiversArray });
  }

  // Remove message id
  delete this.lostMessages[id];
}

Chat.prototype.generateMessageID = function() {
  var text = "",
      possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < 25; i++ ) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

Chat.prototype.generateMessageLostObject = function(name) {
  var id = this.generateMessageID(),
      servers = this.servers,
      serverList = {},
      time = Date.now();

  // Generate a list of the other servers
  Object.keys(servers).forEach(function(server) {
    if(servers[server].type !== "chat") return;
    if(servers[server].description !== servers[name].description) return;

    serverList[server] = {
      received: false,
      time: null
    };
  });

  var _self = this;
  setTimeout(function() {
    _self.checkLostMessages.call(_self, id);
  }, 60000);

  this.lostMessages[id] = {
    origin: name,
    sent: time,
    receivers: serverList
  }

  return { id: id, time: time };
}

Chat.prototype.pingChat = function() {
  var _self = this,
      servers = this.servers;

  Object.keys(servers).forEach(function(name) {
    var server = servers[name];

    var channel = server.channel ? server.channel : '#'+config.irc.username;

    if(server.type === "chat") {
      if(server.pings.length > 50) {
        for(var i=0; i<server.pings.length-50; i++) {
          server.pings.shift();
        }
      }
      if(server.firstMessage === true) {
        server.client.privmsg(channel, "firstmessage "+name+" 0 0 v3");
      } else {
        var data = _self.generateMessageLostObject(name);
        server.client.privmsg(channel, name+" "+data.time+" "+data.id+" v3");
      }
    }
  });
}

Chat.prototype.setup = function(server) {
  var _self = this,
      server = this.servers[server.name];

  server.joined = false;
  server.monitorjoined = false;
  server.pings = [];
  server.alerts = [];
  server.errors = {
    connection: 0,
    join: 0,
    lines: 0,
    total: 0
  };

  server.lastMessage = Date.now();

  var channel = server.channel ? server.channel : '#'+config.irc.username;

  // We run two connections per server. One sender, One monitor
  server.client = new tmi({
    host: server.host,
    port: server.port,
    nick: config.irc.username,
    pass: "oauth:"+config.irc.access_token,
    protocol: server.protocol,
    secure: server.secure
  });
  server.clientMonitor = new tmi({
    host: server.host,
    port: server.port,
    nick: config.irc.username,
    pass: "oauth:"+config.irc.access_token,
    protocol: server.protocol,
    secure: server.secure
  });

  this.connectionQueue.push(server.client);
  this.connectionQueue.push(server.clientMonitor);

  // If there's a connection error, mark the server offline
  server.client.on('disconnected', function() {
    console.log("%s disconnected on port %d over %s", server.host, server.port, server.protocol);
    server.status = "offline";
    _self.connectionQueue.push(server.client);
  });
  server.clientMonitor.on('disconnected', function() {
    console.log("%s disconnected on port %d over %s", server.host, server.port, server.protocol);
    server.status = "offline";
    _self.connectionQueue.push(server.clientMonitor);
  });

  // When we get the MOTD (if we're disconnected), make sure we mark that we haven't joined yet.
  server.client.on('connected', function() {
    console.log("%s connected on port %d over %s", server.host, server.port, server.protocol);
    server.joined = false;
    server.firstMessage = true;
    server.client.join(channel);
  });
  server.clientMonitor.on('connected', function() {
    console.log("%s (monitor) connected on port %d over %s", server.host, server.port, server.protocol);
    server.joined = false;
    server.clientMonitor.join(channel);
  });

  // When we get NAMES, mark the channel as joined
  server.client.on('join', function() {
    server.joined = true;
  });
  server.clientMonitor.on('join', function() {
    server.monitorJoined = true;
  });

  // Parse incoming messages to test for "ping"
  server.clientMonitor.on('privmsg', function(data) {
    var from = data.nick;
    var message = data.message;
    var target = data.target;

    if(channel !== target) return;
    if(from !== config.irc.username) return;

    var timeNow = Date.now();

    // For some reason, your first message always come through more quickly/reliably than the rest.
    // Lets just discard it.
    if(server.firstMessage) {
      server.firstMessage = false;
      return;
    }

    var params = message.split(" ");

    // Check if we have a valid message ID
    var lostMessageID = params[2];
    if(!_self.lostMessages[lostMessageID]) return;

    // If we received a message, make sure we mark this server as working "ok"
    // by marking it as having received the message
    var receiver = _self.lostMessages[lostMessageID].receivers[server.name];
    receiver.received = true;
    receiver.time = Date.now();

    // If the server we got the message from is itself (we run 2 connections per server),
    // measure the "ping"
    if(server.name === params[0]) {
      // timeThen is the time the message was sent
      var timeThen = parseInt(message.split(" ")[1]);

      server.pings.push(timeNow-timeThen-75);

      // Calculate average ping over past minute
      var avgPing = 0;
      if(server.pings.length <= 6) {
        server.pings.forEach(function(lag){
          avgPing += lag;
        });
        server.lag = Math.round(avgPing/server.pings.length);
      } else {
        for(var i=server.pings.length-1; i>=server.pings.length-7; i--) {
          avgPing += server.pings[i];
        }
        server.lag = Math.round(avgPing/6);
      }

      // If messages take longer than 3 seconds to go through, the server is slow.
      // If the server has more than 20 errors, the server is slow.
      if(server.lag > 3000) {
        server.status = "slow";
      } else if(server.errors.total >= 20) {
        server.status = "slow";
      } else {
        server.status = "online";
      }
      server.lastMessage = Date.now();
    }
  });

  setInterval(function() {
    // When joins fail, we need to try to join the channel again.
    if(server.monitorJoined === false) {
      server.clientMonitor.join(channel);
    }
    if(server.joined === false) {
      server.client.join(channel);
    }

    // If the connection seems inactive, mark the server as offline.
    var timeNow = Date.now(),
        timeThen = server.lastMessage;
    if(timeNow-timeThen > 120000) {
      server.status = 'offline';
    }    
  }, 5000);

  setInterval(function() {
    // If the connection seems or is offline, we reconnect periodically.
    if(server.status === 'offline') {
      server.client.disconnect();
      server.clientMonitor.disconnect();

      // Wait a short time before reconnecting.
      setTimeout(function() {
        _self.connectionQueue.push(server.client);
        _self.connectionQueue.push(server.clientMonitor);
      }, 5000);
    }
  }, 300000);
}

Chat.prototype.updateStats = function() {
  var db = this.db,
      servers = this.servers;
  

  // Reset stats
  Object.keys(servers).forEach(function(name) {
    var server = servers[name];
    if(server.type !== "chat") return;
    server.errors.connection = 0;
    server.errors.join = 0;
    server.errors.lines = 0;
    server.errors.total = 0;
    server.alerts = [];
  });

  // Increment error counts
  this.storedReports.forEach(function(report) {
    if(!servers[report.server]) return;

    if(new Date(report.logged).getTime() > past60Time) {
      if(report.type === "chat" && report.kind === "join") {
        servers[report.server].errors.join++;
      } else if(report.type === "chat" && report.kind === "lines") {
        servers[report.server].errors.lines++;
      }
    }
    servers[report.server].errors.total++;
  });

  // Generate alerts and set server statuses
  Object.keys(servers).forEach(function(name) {
    var server = servers[name];
    if(server.type !== "chat") return;

    var type;
    if(server.errors.join > 0) {
      if(server.errors.join > 50) {
        type = "important";
      } else if(server.errors.join > 25) {
        type = "warning";
      } else {
        type = "info";
      }
      server.alerts.push({ type: type, message: "Joins Failing" });
    }
    if(server.errors.lines > 0) {
      if(server.errors.lines > 12) {
        type = "important";
      } else if(server.errors.lines > 6) {
        type = "warning";
      } else {
        type = "info";
      }
      server.alerts.push({ type: type, message: "Messages Lost" });
    }

    // If messages take longer than 3 seconds to go through, the server is slow.
    // If the server has more than 20 errors, the server is slow.
    if(server.status !== "offline") {
      if (server.errors.total <= 20 && server.lag <= 3000) {
        server.status = "online";
      } else if (server.errors.total >= 20) {
        server.status = "slow";
      }
    }
  });
}

module.exports = Chat;