module.exports = function(main) {

  var app = main.app,
      servers = main.servers;

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
        secure: server.secure,
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

  // Catch-all not found
  app.get('*', function(req, res){
    res.status(404).send('404 Not Found');
  });
}