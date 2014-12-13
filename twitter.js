var config = require('./config.json'),
    twitter = new require('twitter')({
      consumer_key: config.twitter.consumer_key,
      consumer_secret: config.twitter.consumer_secret,
      access_token_key: config.twitter.access_token_key,
      access_token_secret: config.twitter.access_token_secret
    });

var Twitter = function() {
  this.tweets = [];

  this.updateTweets(this);

  var _self = this;
  setInterval(function() {
    _self.updateTweets();
  }, 30000);
}

Twitter.prototype.updateTweets = function() {
  var _self = this;

  twitter.search('#twitchstatus OR twitchstatus.com OR twitchstatus.net -istwitchdown.com', { count: 50 }, function(data) {
    if(!data.statuses) return;

    _self.tweets = [];
    data.statuses.forEach(function(status) {
      if(status.retweeted_status) return;
      
      _self.tweets.push('@<a href="https://twitter.com/'+status.user.screen_name+'" target="_blank">'+status.user.screen_name+'</a>: '+status.text.replace('<','&lt;').replace('>','&gt;'));
    });
  });
}

module.exports = Twitter;