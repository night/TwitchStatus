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

// Snooping my code? You can use api/status?type= to grab a type of service
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
                var chatType = (/ Chat Server$/.test(d.description)) ? d.description.match(/^([a-zA-Z]+) Chat Server$/)[1].toLowerCase() : "main";
                $("#chat_"+chatType+" tbody").append('<tr data-server="'+serverName+'"><td>'+d.server.replace(/:([0-9]+)/g," (Port $1)")+(d.description!=='Chat Server'?' &mdash; '+d.description:'')+' <span class="alerts" style="float: right;"></span></td><td class="protocol" style="text-align:center;">Loading..</td><td class="status" style="text-align:center;">Loading..</td><td class="errors" style="text-align:center;">Loading..</td><td class="lag" style="text-align:center;">Loading..</td><td class="graph" style="vertical-align:middle;">Loading..</td></tr>');
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
                if(d.port !== 6667) disruption++;
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
                chatType = (/ Chat Server$/.test(d.description)) ? d.description.match(/^([a-zA-Z]+) Chat Server$/)[1].toLowerCase() : "main";
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
          $('#realtimeChatHolder').attr('class', 'span8');
          $("#realtimeChatCount").highcharts().setSize($('#realtimeChatHolder').width(), 278, false);
          $('#nomNomNom').fadeIn();
        } else {
          $('#realtimeChatHolder').attr('class', 'span12');
          $("#realtimeChatCount").highcharts().setSize($('#realtimeChatHolder').width(), 250, false);
          $('#nomNomNom').fadeOut();
        }
        if(disruption === 0) {
          $("#entireStatus").html('<span style="font-size:18px;color:green;line-height:20px;display:block;padding: 15px 15px 0px 0px;">Online</span>');
          $('#marquee-holder').slideUp('slow');
        } else {
          $("#entireStatus").html('<span style="font-size:18px;color:orange;line-height:20px;display:block;padding: 15px 15px 0px 0px;">Disrupted</span>');
          $.getJSON("api/tweets", function(data) {
            $('#marquee-holder').slideUp('slow');
            $('#marquee-holder').html('<marquee scrollamount="2"></marquee>');
            $('#marquee-holder').slideDown('slow');
            $('marquee').html(":: #TwitchStatus :: "+data.text);
            $('marquee').marquee('pointer').mouseover(function () {
              $(this).trigger('stop');
            }).mouseout(function () {
              $(this).trigger('start');
            }).mousemove(function (event) {
              if ($(this).data('drag') == true) {
                this.scrollLeft = $(this).data('scrollX') + ($(this).data('x') - event.clientX);
              }
            }).mousedown(function (event) {
              $(this).data('drag', true).data('x', event.clientX).data('scrollX', this.scrollLeft);
            }).mouseup(function () {
              $(this).data('drag', false);
            });
          });
        }
    });
    setTimeout(updateStatus, 60000);
}

Highcharts.theme = {
   colors: ["#DDDF0D", "#7798BF", "#55BF3B", "#DF5353", "#aaeeee", "#ff0066", "#eeaaee",
      "#55BF3B", "#DF5353", "#7798BF", "#aaeeee"],
   chart: {
      backgroundColor: {
         linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
         stops: [
            [0, 'rgb(96, 96, 96)'],
            [1, 'rgb(16, 16, 16)']
         ]
      },
      borderWidth: 0,
      borderRadius: 5,
      plotBackgroundColor: null,
      plotShadow: false,
      plotBorderWidth: 0
   },
   title: {
      style: {
         color: '#FFF',
         font: '16px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
      }
   },
   subtitle: {
      style: {
         color: '#DDD',
         font: '12px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
      }
   },
   xAxis: {
      gridLineWidth: 0,
      lineColor: '#999',
      tickColor: '#999',
      labels: {
         style: {
            color: '#999',
            fontWeight: 'bold'
         }
      },
      title: {
         style: {
            color: '#AAA',
            font: 'bold 12px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
         }
      }
   },
   yAxis: {
      alternateGridColor: null,
      minorTickInterval: null,
      gridLineColor: 'rgba(255, 255, 255, .1)',
      minorGridLineColor: 'rgba(255,255,255,0.07)',
      lineWidth: 0,
      tickWidth: 0,
      min: 0,
      labels: {
         style: {
            color: '#999',
            fontWeight: 'bold'
         }
      },
      title: {
         style: {
            color: '#AAA',
            font: 'bold 12px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
         }
      }
   },
   legend: {
      itemStyle: {
         color: '#CCC'
      },
      itemHoverStyle: {
         color: '#FFF'
      },
      itemHiddenStyle: {
         color: '#333'
      }
   },
   labels: {
      style: {
         color: '#CCC'
      }
   },
   tooltip: {
      backgroundColor: {
         linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
         stops: [
            [0, 'rgba(96, 96, 96, .8)'],
            [1, 'rgba(16, 16, 16, .8)']
         ]
      },
      borderWidth: 0,
      style: {
         color: '#FFF'
      }
   },


   plotOptions: {
      series: {
         shadow: true
      },
      line: {
         dataLabels: {
            color: '#CCC'
         },
         marker: {
            lineColor: '#333'
         }
      },
      spline: {
         marker: {
            lineColor: '#333'
         }
      },
      scatter: {
         marker: {
            lineColor: '#333'
         }
      },
      candlestick: {
         lineColor: 'white'
      }
   },

   toolbar: {
      itemStyle: {
         color: '#CCC'
      }
   },

   navigation: {
      buttonOptions: {
         symbolStroke: '#DDDDDD',
         hoverSymbolStroke: '#FFFFFF',
         theme: {
            fill: {
               linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
               stops: [
                  [0.4, '#606060'],
                  [0.6, '#333333']
               ]
            },
            stroke: '#000000'
         }
      }
   },

   // scroll charts
   rangeSelector: {
      buttonTheme: {
         fill: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
               [0.4, '#888'],
               [0.6, '#555']
            ]
         },
         stroke: '#000000',
         style: {
            color: '#CCC',
            fontWeight: 'bold'
         },
         states: {
            hover: {
               fill: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                  stops: [
                     [0.4, '#BBB'],
                     [0.6, '#888']
                  ]
               },
               stroke: '#000000',
               style: {
                  color: 'white'
               }
            },
            select: {
               fill: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                  stops: [
                     [0.1, '#000'],
                     [0.3, '#333']
                  ]
               },
               stroke: '#000000',
               style: {
                  color: 'yellow'
               }
            }
         }
      },
      inputStyle: {
         backgroundColor: '#333',
         color: 'silver'
      },
      labelStyle: {
         color: 'silver'
      }
   },

   navigator: {
      handles: {
         backgroundColor: '#666',
         borderColor: '#AAA'
      },
      outlineColor: '#CCC',
      maskFill: 'rgba(16, 16, 16, 0.5)',
      series: {
         color: '#7798BF',
         lineColor: '#A6C7ED'
      }
   },

   scrollbar: {
      barBackgroundColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
               [0.4, '#888'],
               [0.6, '#555']
            ]
         },
      barBorderColor: '#CCC',
      buttonArrowColor: '#CCC',
      buttonBackgroundColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
               [0.4, '#888'],
               [0.6, '#555']
            ]
         },
      buttonBorderColor: '#CCC',
      rifleColor: '#FFF',
      trackBackgroundColor: {
         linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
         stops: [
            [0, '#000'],
            [1, '#333']
         ]
      },
      trackBorderColor: '#666'
   },

   // special colors for some of the demo examples
   legendBackgroundColor: 'rgba(48, 48, 48, 0.8)',
   legendBackgroundColorSolid: 'rgb(70, 70, 70)',
   dataLabelsColor: '#444',
   textColor: '#E0E0E0',
   maskColor: 'rgba(255,255,255,0.3)'
};

$(document).ready(function () {
    updateStatus();

    $('.nav-tabs li a').click(function() {
      setTimeout(generateGraphs, 500);
    });

    Highcharts.setOptions(Highcharts.theme);

    Highcharts.setOptions({
        global: {
            useUTC: false
        },
        credits: {
            enabled: false
        }
    });

    var data = {
        realtimeEmoteCounts: false,
        realtimeChatCounts: false,
        emotes: {}
    };

    var chart;
    $('#realtimeChatCount').highcharts({
        chart: {
            type: 'spline',
            animation: Highcharts.svg, // don't animate in old IE
            marginRight: 10,
            events: {
                load: function() {
                    data.realtimeChatCounts = this.series[0];
                }
            }
        },
        title: {
            text: 'Realtime Chat Lines'
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: 'Lines Per Second'
            },
            plotLines: [{
                value: 0,
                width: 1,
                color: '#808080'
            }]
        },
        tooltip: {
            formatter: function() {
                    return '<b>'+ this.series.name +'</b><br/>'+
                    Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) +'<br/>'+
                    this.y+' lines';
            }
        },
        exporting: {
          enabled: false
        },
        legend: {
            enabled: false
        },
        series: [{
            name: 'Lines Per Second',
            data: (function() {
                var data = [],
                    time = (new Date()).getTime(),
                    i;

                for (i = -30; i <= 0; i++) {
                    data.push({
                        x: time + i * 1000,
                        y: -1
                    });
                }
                return data;
            })()
        }]
    });

    var socket = io.connect('http://198.245.61.154:9001/');
    socket.on('connect', function () {
        console.log("Connected to Socket Server");
    });

    socket.on('ohai', function () {
        console.log("Ready to receive data");
    });

    socket.on('realtime_update', function (d) {
        var x = (new Date()).getTime(),
            y = d.totalChatLines;

        data.realtimeChatCounts.addPoint([x, y], true, true);
    });
});
