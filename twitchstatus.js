var chat = require("./chat"),
  chatServers = require("./chat-servers"),
  config = require("./config.json"),
  express = require("express"),
  http = require("./http"),
  ingests = require("./ingests");

TwitchStatus = function () {
  this.app = express();

  process.on("uncaughtException", function (err) {
    console.log("Caught exception: " + err);
    console.log(err.stack);
  });

  this.app.listen(8080, "localhost");
  this.app.disable("x-powered-by");
  this.app.use(express.static(__dirname + "/public_html"));
  this.app.use("/", express.static(__dirname + "/public_html/index.html"));

  this._servers = [
    {
      name: "Twitch.TV",
      type: "web",
      description: "Twitch's main website",
      host: "www.twitch.tv",
      path: "/",
      port: 443,
    },
    {
      name: "API.Twitch.TV",
      type: "web",
      description: "Twitch's external endpoint for data retrieval",
      host: "api.twitch.tv",
      path: "/helix/streams",
      port: 443,
    },
    {
      name: "TMI.Twitch.TV",
      type: "web",
      description:
        "Chat user lists (if this is down, mod status may also be broken)",
      host: "tmi.twitch.tv",
      path: "/group/user/" + config.irc.username,
      port: 443,
    },
  ];
  this.servers = {};

  this.reports = [];
  this.lostMessages = [];

  this.chat = new chat(this);
  this.http = new http(this);

  var _self = this;
  ingests(function (servers) {
    _self._servers = _self._servers.concat(servers);

    chatServers(function (servers) {
      _self._servers = _self._servers.concat(servers);

      _self.setup();
    });
  });

  setInterval(function () {
    _self.cleanup();
  }, 30000);
};

TwitchStatus.prototype.setup = function () {
  // Setup server monitoring
  for (var i = 0; i < this._servers.length; i++) {
    var server = this._servers[i];

    this.servers[server.name] = {
      name: server.name,
      type: server.type,
      description: server.description,
      host: server.host.toLowerCase(),
      port: server.port,
      path: server.path,
      cluster: server.cluster || undefined,
      channel: server.channel || undefined,
      protocol: server.protocol || undefined,
      secure: server.secure || false,
      status: "unknown",
      lag: 999999,
    };

    if (server.type === "chat") {
      this.chat.setup(server);
    }
  }

  this.http.checkStatus();

  // Setup express routes
  require("./routes")(this);
};

TwitchStatus.prototype.cleanup = function () {
  var current = Math.round(Date.now() / 1000),
    past5 = (current - 300) * 1000,
    limit = new Date(past5);

  for (var i = this.reports.length - 1; i >= 0; i--) {
    if (this.reports[i].logged < limit) {
      this.reports.splice(i, 1);
    }
  }

  for (var i = this.lostMessages.length - 1; i >= 0; i--) {
    if (this.lostMessages[i].sent < limit) {
      this.lostMessages.splice(i, 1);
    }
  }
};

new TwitchStatus();
