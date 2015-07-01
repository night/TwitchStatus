module.exports = function(main) {

  var app = main.app,
      db = main.db,
      servers = main.servers,
      twitter = main.twitter;

  // Dropped messages in past 5 minutes
  app.get('/api/messages', function(req, res) {
    var currentTime = Math.round(Date.now() / 1000),
        past5Time = (currentTime - 300) * 1000,
        past60Time = (currentTime - 60) * 1000;

    var currentDate = new Date(),
        past5Date = new Date(past5Time);

    db.messages.find({
      sent: {
        $gte: past5Date,
        $lt: currentDate
      }
    }, function(error, messages) {
      res.jsonp(200, messages);
    });
  });

  var getAlerts = function(type) {
    var alerts = [];

    Object.keys(servers).forEach(function(name) {
      var server = servers[name];

      if(server.type !== type) return;

      if(server.alerts.length > 0) {
        server.alerts.forEach(function(alert) {
          alerts.push({
            server: name,
            type: alert.type,
            message: alert.message
          });
        });
      }
    });

    return alerts;
  }

  var formatServers = function(type) {
    var formatted = [];

    Object.keys(servers).forEach(function(name) {
      var server = servers[name];

      if(server.type !== type) return;

      formatted.push({
        server: name,
        cluster: server.cluster,
        host: server.type !== "chat" ? server.host : undefined,
        ip: server.type === "chat" ? server.host : undefined,
        port: server.port,
        protocol: server.protocol,
        description: server.description,
        status: server.status,
        loadTime: server.type !== "chat" ? server.lag : undefined,
        errors: server.errors ? server.errors.total : undefined,
        lag: server.type === "chat" ? server.lag : undefined,
        pings: server.type === "chat" ? server.pings : undefined
      });
    });

    return formatted;
  };

  app.get('/api/status', function(req, res) {
    switch(req.query.type) {
      case "web":
      case "ingest":
      case "chat":
        res.jsonp(formatServers(req.query.type));
        break;
      default:
        res.jsonp({
          web: {
            alerts: [],
            servers: formatServers('web')
          },
          ingest: {
            alerts: [],
            servers: formatServers('ingest')
          },
          chat: {
            alerts: getAlerts('chat'),
            servers: formatServers('chat')
          }
        });
        return;
    }
  });

  // Tweets about TwitchStatus for when outages occur
  app.get('/api/tweets', function(req, res) {
    res.json({ text: twitter.tweets.join(' | ') });
  });

  // Catch-all not found
  app.get('*', function(req, res){
    res.send(404, '404 Not Found');
  });
}