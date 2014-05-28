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

  // External Reporting
  app.get('/api/report', function(req, res) {
    if(!req.param("type")) {
      res.send(400, "No type?");
      return;
    }
    if(!req.param("server")) {
      res.send(400, "No server?");
      return;
    }
    if(!req.param("kind")) {
      res.send(400, "No kind?");
      return;
    }

    var reportedServer = req.param("server");
    if(!reportedServer.match(/^(.*):(80|443|6667)$/)) {
      reportedServer = reportedServer+":80";
    }

    db.reports.save({ type: req.param("type").toLowerCase(), kind: req.param("kind").toLowerCase(), server: reportedServer.toLowerCase(), logged: new Date() }, function(err, saved) {
      if( err || !saved ) {
        res.send(500, "Error saving data");
      } else {
        res.send(200, "Report received");
      }
    });
  });

  app.get('/api/status', function(req, res) {
    if(req.param("type") && req.param("type") === "web") {
      var reply = [];
      Object.keys(servers).forEach(function(name) {
        var server = servers[name];
        if(server.type !== "web") return;
        reply.push({ server: name, host: server.host, port: server.port, description: server.description, status: server.status, loadTime: server.lag });
      });
      res.jsonp(reply);
    } else if(req.param("type") && req.param("type") === "ingest") {
      var reply = [];
      Object.keys(servers).forEach(function(name) {
        var server = servers[name];
        if(server.type !== "ingest") return;
        reply.push({ server: name, host: server.host, port: server.port, description: server.description, status: server.status });
      });
      res.jsonp(reply);
    } else if(req.param("type") && req.param("type") === "chat") {
      var reply = [];
      Object.keys(servers).forEach(function(name) {
        var server = servers[name];
        if(server.type !== "chat") return;
        reply.push({ server: name, ip: server.host, port: server.port, description: server.description, status: server.status, errors: server.errors.total, lag: server.lag });
      });
      res.jsonp(reply);
    } else {
      var reply = {};
      reply.web = {
        alerts: [],
        servers: []
      };
      reply.ingest = {
        alerts: [],
        servers: []
      };
      reply.chat = {
        alerts: [],
        servers: []
      };
      Object.keys(servers).forEach(function(name) {
        var server = servers[name];
        if(server.type === "web") {
          reply.web.servers.push({ server: name, host: server.host, port: server.port, description: server.description, status: server.status, loadTime: server.lag });
        } else if(server.type === "ingest") {
          reply.ingest.servers.push({ server: name, host: server.host, port: server.port, description: server.description, status: server.status });
        } else if(server.type === "chat") {
          if(server.alerts.length > 0) {
            server.alerts.forEach(function(alert) {
              reply.chat.alerts.push({
                server: name,
                type: alert.type,
                message: alert.message
              });
            });
          }
          
          reply.chat.servers.push({ server: name, ip: server.host, port: server.port, description: server.description, status: server.status, errors: server.errors.total, lag: server.lag, pings: server.pings });
        }

      });
      res.jsonp(reply);
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