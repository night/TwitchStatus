var request = require("request");
var config = require("./config.json");

module.exports = function (callback) {
  request(
    {
      url: "https://ingest.twitch.tv/ingests",
      headers: {
        "Client-ID": config.irc.client_id,
      },
      json: true,
      timeout: 60000,
    },
    function (error, response, data) {
      if (error || !data.ingests) {
        callback([]);
        return;
      }

      var servers = [];
      data.ingests.forEach(function (ingest) {
        var host = ingest.url_template.split("/")[2],
          port = 1935;

        var server = {
          name: host
            .replace(/^live/, "Live")
            .replace(".justin.", ".twitch.")
            .replace(".twitch.", ".Twitch.")
            .replace(".tv", ".TV"),
          type: "ingest",
          description: ingest.name
            .replace("Midwest", "Central")
            .replace("Asia", "AS")
            .replace("Australia", "AU"),
          host: host,
          port: port,
        };

        servers.push(server);
      });

      servers.sort(function (a, b) {
        return a.description.localeCompare(b.description);
      });

      callback(servers);
    }
  );
};
