$('.navbar').scrollspy();
$('.navbar a').smoothScroll();

function generateGraphs() {
  $('.graph span').each(function() {
    var pings = $(this).data('pings').split(',');
    for(var i=0; i<pings.length; i++) {
      pings[i] = parseInt(pings[i]);
    }
    $(this).sparkline(pings, {
      width: "110px",
      tooltipSuffix: " ms",
      lineColor: $(this).data('color'),
      fillColor: $(this).data('color'),
      spotColor: "undefined",
      minSpotColor: "undefined",
      maxSpotColor: "undefined",
      highlightSpotColor: "undefined",
      highlightLineColor: "undefined",
      lineWidth: 2
    });
  });
}

function updateStatus() {
    var disruption = 0;
    var messagesLost = 0;
    $.getJSON("api/status", function(data) {
        if($("#webServicesTable").text().trim() == "") {
            data.web.servers.forEach(function(d){
                var serverName = d.server.replace(/(\.|\(|\)|:)/g,"_");
                $("#webServicesTable").append('<tr data-server="'+serverName+'"><td class="name">'+d.server+'</td><td class="description">'+d.description+'</td><td class="status" style="text-align:center;">Loading..</td><td class="loadTime" style="text-align:center;">Loading..</td></tr>');
            });
            data.ingest.servers.forEach(function(d){
                var serverName = d.server.replace(/(\.|\(|\)|:)/g,"_");
                $("#ingestTable").append('<tr data-server="'+serverName+'"><td class="name">'+d.server+'</td><td class="description">'+d.description+'</td><td class="status" style="text-align:center;">Loading..</td></tr>');
            });
            data.chat.servers.forEach(function(d){
                var serverName = d.server.replace(/(\.|\(|\)|:)/g,"_");
                var chatType = d.cluster;
                $("#chat_"+chatType+" tbody").append('<tr data-server="'+serverName+'"><td>'+d.server.replace(/:([0-9]+)/g," (Port $1") + (d.secure ? ', Secure)' : ')') +(d.description!=='Chat Server'?' &mdash; '+d.description:'')+' <span class="alerts" style="float: right;"></span></td><td class="protocol" style="text-align:center;">Loading..</td><td class="status" style="text-align:center;">Loading..</td><td class="errors" style="text-align:center;">Loading..</td><td class="lag" style="text-align:center;">Loading..</td><td class="graph" style="vertical-align:middle;">Loading..</td></tr>');
            });
        }
        data.web.servers.forEach(function(d){
            if(d.status === "online") {
                d.status = '<span class="label label-success">Online</span>';
            } else if(d.status === "offline") {
                disruption++;
                d.status = '<span class="label label-important">Offline</span>';
            } else if(d.status === "slow") {
                d.status = '<span class="label label-warning">Slow</span>';
            } else if(d.status === "unknown") {
                d.status = '<span class="label">Unknown</span>';
            }
            if(d.loadTime >= 1000) {
                d.loadTime = parseFloat(d.loadTime/1000).toFixed(2) + " s";
            } else {
                d.loadTime = d.loadTime + " ms";
            }
            var serverName = d.server.replace(/(\.|\(|\)|:)/g,"_"),
                $server = $("#webServicesTable").children("tr[data-server='"+serverName+"']");
            $server.children("td.status").html(d.status);
            $server.children("td.loadTime").html(d.loadTime);
        });
        data.ingest.servers.forEach(function(d){
            if(d.status === "online") {
                d.status = '<span class="label label-success">Online</span>';
            } else if(d.status === "offline") {
                disruption++;
                d.status = '<span class="label label-important">Offline</span>';
            } else if(d.status === "slow") {
                disruption++;
                d.status = '<span class="label label-warning">Slow</span>';
            } else if(d.status === "unknown") {
                d.status = '<span class="label">Unknown</span>';
            }
            var serverName = d.server.replace(/(\.|\(|\)|:)/g,"_"),
                $server = $("#ingestTable").children("tr[data-server='"+serverName+"']");
            $server.children("td.status").html(d.status);
        });
        data.chat.servers.forEach(function(d){
            var offline = false;
            if(d.status === "online") {
                d.status = '<span class="label label-success">Online</span>';
            } else if(d.status === "offline") {
                offline = true;
                d.status = '<span class="label label-important">Offline</span>';
            } else if(d.status === "slow") {
                disruption++;
                d.status = '<span class="label label-warning">Slow</span>';
            } else if(d.status === "unknown") {
                d.status = '<span class="label">Unknown</span>';
            }
            if(offline === true) {
                d.lag = '<span class="badge badge-important">N/A</span>';
                d.errors = '<span class="badge badge-important">N/A</span>';
                d.pings = [0,0];
                var lagColor = "#FF0000";
            } else {
                if(d.errors <= 5) {
                    d.errors = '<span class="badge badge-success">'+d.errors+' errors</span>';
                } else if(d.errors <= 10) {
                    d.errors = '<span class="badge badge-warning">'+d.errors+' errors</span>';
                } else if(d.errors > 10) {
                    d.errors = '<span class="badge badge-important">'+d.errors+' errors</span>';
                }
                if(d.lag >= 1000) {
                    d.lagFormatted = parseFloat(d.lag/1000).toFixed(2) + " s";
                } else {
                    d.lagFormatted = d.lag + " ms";
                }
                if(d.lag < 300) {
                    d.lag = '<span class="badge badge-success">'+d.lagFormatted+'</span>';
                    if(d.lag === 0) {
                        var lagColor = "#FF0000";
                    } else {
                        var lagColor = "#008800";
                    }
                } else if(d.lag <= 400) {
                    d.lag = '<span class="badge badge-warning">'+d.lagFormatted+'</span>';
                    var lagColor = "#FFEF00";
                } else if(d.lag > 400) {
                    d.lag = '<span class="badge badge-important">'+d.lagFormatted+'</span>';
                    var lagColor = "#FF0000";
                }
            }
            if(d.pings.length < 2) {
                d.pings = [0,0];
            }
            var serverName = d.server.replace(/(\.|\(|\)|:)/g,"_"),
                chatType = d.cluster;
                $server = $("#chat_"+chatType+" tbody").children("tr[data-server='"+serverName+"']");
            $server.children("td").children(".alerts").html('');
            $server.children("td.status").html(d.status);
            $server.children("td.errors").html(d.errors);
            $server.children("td.protocol").html(d.protocol);
            $server.children("td.lag").html(d.lag);
            var $graph = $('<span/>');
            $graph.data('color', lagColor);
            $graph.data('pings', d.pings.toString());
            $server.children("td.graph").html($graph);
        });
        generateGraphs();
        data.chat.alerts.forEach(function(alert) {
          var serverName = alert.server.replace(/(\.|\(|\)|:)/g,"_"),
              $server = $("tr[data-server='"+serverName+"']");

          if($server.children("td.status").children("span").text() === "Offline") return;

          if(alert.message === 'Messages Lost') {
            if(alert.type === 'info') {
              messagesLost += 2;
            } else if(alert.type === 'warning') {
              messagesLost += 5;
            } else {
              messagesLost += 10;
            }
          }
          
          $server.children("td").children(".alerts").prepend('<span class="badge badge-'+alert.type+'">'+alert.message+'</span>&nbsp;&nbsp;');
        });
        if(data.chat.banned) {
          $('#banned-alert').fadeIn();
        } else {
          $('#banned-alert').fadeOut();
        }
        if(messagesLost >= 20) {
          $('#nomNomNom').fadeIn();
        } else {
          $('#nomNomNom').fadeOut();
        }
        if(disruption === 0) {
          $("#entireStatus").html('<span style="font-size:18px;color:green;line-height:20px;display:block;padding: 15px 15px 0px 0px;">Online</span>');
        } else {
          $("#entireStatus").html('<span style="font-size:18px;color:orange;line-height:20px;display:block;padding: 15px 15px 0px 0px;">Disrupted</span>');
        }
    });
    setTimeout(updateStatus, 60000);
}

$(document).ready(function () {
    updateStatus();

    $('.nav-tabs li a').click(function() {
      setTimeout(generateGraphs, 500);
    });
});
