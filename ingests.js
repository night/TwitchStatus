var request = require('request');

module.exports = function(callback) {
  request({
    url: "https://api.twitch.tv/kraken/ingests",
    json: true,
    timeout: 10000
  }, function(error, response, data) {
    if(error || !data.ingests) {
      callback([]);
      return;
    }
    
    var servers = [];
    data.ingests.forEach(function(ingest) {
      var host = ingest.url_template.split('/')[2],
          port = 1935;

      var server = {
        name: host.replace(/^live/,'Live').replace('.justin.','.twitch.').replace('.twitch.','.Twitch.').replace('.tv','.TV'),
        type: "ingest",
        description: ingest.name.replace('Midwest', 'Central').replace('Asia', 'AS'),
        host: host,
        port: port
      };

      servers.push(server);
    });

    servers.sort(function(a, b) {
      return a.description.localeCompare(b.description);
    });

    callback(servers);
  });
}