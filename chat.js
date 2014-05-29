var config = require('./config.json'),
    irc = require('irc');

var Chat = function(main) {
  this.db = main.db;
  this.servers = main.servers;

  this.lostMessages = {};

  var _self = this;
  setInterval(function() {
    _self.updateStats();
  }, 30000);
  setInterval(function() {
    _self.pingChat();
  }, 10000);
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
    db.reports.save({type: "chat", kind: "lines", server: data.origin, logged: new Date() }, function(err, saved) {
      if( err || !saved ) {
        console.log("Error saving lines report.");
      }
    });
    receiversArray.forEach(function(receiver) {
      if(receiver.received) {
        db.reports.save({type: "chat", kind: "lines", server: receiver.server, logged: new Date() }, function(err, saved) {
          if( err || !saved ) {
            console.log("Error saving lines report.");
          }
        });
      }
    });
  } else {
    receiversArray.forEach(function(receiver) {
      if(!receiver.received) {
        db.reports.save({type: "chat", kind: "lines", server: receiver.server, logged: new Date() }, function(err, saved) {
          if( err || !saved ) {
            console.log("Error saving lines report.");
          }
        });
      }
    });
  }

  if(percentLost > 0) {
    db.messages.save({ origin: { server: data.origin, ip: data.origin.split(':')[0], port: parseInt(data.origin.split(':')[1]) }, sent: new Date(data.sent), percentLost: percentLost, percentReceived: percentReceived, receivers: receiversArray }, function(err, saved) {
      if( err || !saved ) {
        console.log(err);
        console.log("Error saving messages report.");
      }
    });
  }
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
    if(server.type === "chat") {
      if(server.pings.length > 49) {
        server.pings.shift();
      }
      if(server.firstMessage === true) {
        server.client.say('#'+config.irc.username, "firstmessage "+name+" 0 0 v3");
      } else {
        var data = _self.generateMessageLostObject(name);
        server.client.say('#'+config.irc.username, name+" "+data.time+" "+data.id+" v3");
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

  var ircConfig = {
    channels: ['#'+config.irc.username],
    password: "oauth:"+config.irc.access_token,
    port: server.port,
    debug: false
  }

  // We run two connections per server. One sender, One monitor
  server.client = new irc.Client(server.host, config.irc.username, ircConfig);
  server.clientMonitor = new irc.Client(server.host, config.irc.username, ircConfig);

  // If there's a connection error, mark the server offline
  server.client.addListener('error', function() {
    server.status = "offline";
  });
  server.clientMonitor.addListener('error', function() {
    server.status = "offline";
  });

  // When we get the MOTD (if we're disconnected), make sure we mark that we haven't joined yet.
  server.client.addListener('motd', function() {
    server.joined = false;
    server.firstMessage = true;
  });
  server.clientMonitor.addListener('motd', function() {
    server.joined = false;
  });

  // When we get NAMES, mark the channel as joined
  server.client.addListener('names#'+config.irc.username, function() {
    server.joined = true;
  });
  server.clientMonitor.addListener('names#'+config.irc.username, function() {
    server.monitorJoined = true;
  });

  // Parse incoming messages to test for "ping"
  server.clientMonitor.addListener('message#'+config.irc.username, function (from, message) {
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

      server.pings.push(timeNow-timeThen-40);

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
      server.clientMonitor.send('JOIN', '#'+config.irc.username);
    }
    if(server.joined === false) {
      server.client.send('JOIN', '#'+config.irc.username);
    }

    // If the connection seems inactive, mark the server as offline.
    var timeNow = Date.now(),
        timeThen = server.lastMessage;
    if(timeNow-timeThen > 120000) {
      server.status = false;
    }    
  }, 5000);

  setInterval(function() {
    // If the connection seems or is offline, we reconnect periodically.
    if(server.status === false) {
      server.client.disconnect();
      server.clientMonitor.disconnect();

      // Wait a short time before reconnecting.
      setTimeout(function() {
        server.client.connect();
        server.clientMonitor.connect();
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

  var currentTime = Math.round(Date.now() / 1000),
      past5Time = (currentTime - 300) * 1000,
      past60Time = (currentTime - 60) * 1000;

  var currentDate = new Date(),
      past5Date = new Date(past5Time);

  db.reports.find({
    logged: {
      $gte: past5Date,
      $lt: currentDate
    }
  },function(error, reports){
    if(!reports) return;

    // Increment error counts
    reports.forEach(function(report) {
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
  });
}

module.exports = Chat;