var chat = require('./chat'),
    chatServers = require('./chat-servers'),
    config = require('./config.json'),
    express = require('express'),
    http = require('./http'),
    ingests = require('./ingests'),
    mongojs = require("mongojs"),
    twitter = require('./twitter');

TwitchStatus = function() {
  this.app = express();

  this.app.listen(6699);
  this.app.disable('x-powered-by');
  this.app.use(express.static(__dirname + '/public_html'));
  this.app.use("/", express.static(__dirname + '/public_html/index.html'));

  this.db = mongojs.connect(config.mongodb.database_url, config.mongodb.collections);

  this._servers = [
    { name: "Twitch.TV", type: "web", description: "Twitch's main website", host: "www.twitch.tv", path: "/", port: 80 },
    { name: "API.Twitch.TV", type: "web", description: "Twitch's external endpoint for data retrieval", host: "api.twitch.tv", path: "/kraken/base", port: 443 }
  ];
  this.servers = {};
  
  this.chat = new chat(this);
  this.http = new http(this);
  this.twitter = new twitter();

  var _self = this;
  ingests(function(servers) {
    _self._servers = _self._servers.concat(servers);

    chatServers(function(servers) {
      _self._servers = _self._servers.concat(servers);

      _self.setup();
    });
  });

  setInterval(function() {
    _self.cleanup();
  }, 600000);
}

TwitchStatus.prototype.setup = function() {
  // Setup server monitoring
  for(var i=0; i<this._servers.length; i++) {
    var server = this._servers[i];

    this.servers[server.name] = {
      name: server.name,
      type: server.type,
      description: server.description,
      host: server.host.toLowerCase(),
      port: server.port,
      path: server.path,
      status: "unknown",
      lag: 999999
    }

    if(server.type === "chat") {
      this.chat.setup(server);
    }
  }

  this.http.checkStatus();

  // Setup express routes
  require('./routes')(this);
}

TwitchStatus.prototype.cleanup = function() {
  var current = Math.round(Date.now() / 1000),
      past5 = (current - 300) * 1000,
      limit = new Date(past5);

  this.db.reports.remove({ logged: { $lt: limit } });
  this.db.messages.remove({ logged: { $lt: limit } });
}

new TwitchStatus();