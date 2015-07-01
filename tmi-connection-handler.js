var EventEmitter = require('events').EventEmitter;
var net = require('net');
var parse = require('irc-message').parse;
var util = require('util');
var ws = require('ws');

var IRC = function(options) {
  EventEmitter.call(this);

  this.options = options;
  this._socket = null;
  this._connected = false;
  this._buffer = null;

  if(!this.options.host) {
    throw new Error('No host configured');
    return;
  }

  if(!this.options.port) {
    throw new Error('No port configured');
    return;
  }

  if(!this.options.nick) {
    throw new Error('No nick configured');
    return;
  }

  if(!this.options.protocol) {
    throw new Error('No protocol configured');
    return;
  }
}

util.inherits(IRC, EventEmitter);

// IRC Connections

IRC.prototype._wsConnect = function() {
  var _self = this;
  var socket = new ws('ws://' + this.options.host + ':' + this.options.port, 'irc');

  socket.on('open', function() {
    _self._onOpen();
  });
  socket.on('message', function(data) {
    _self._onData(data);
  });
  socket.on('close', function() {
    _self._onClose();
  });

  this._socket = socket;
};

IRC.prototype._ircConnect = function() {
  var _self = this;
  var socket = net.connect(this.options.port, this.options.host, function() {
    _self._onOpen();
  });

  socket.on('data', function(data) {
    _self._onData(data);
  });
  socket.on('end', function() {
    _self._onClose();
  });
  socket.on('error', function() {
    _self._onClose();
  });

  this._socket = socket;
};

IRC.prototype.connect = function() {
  if(this._socket) return this.reconnect();
  return this.options.protocol === 'irc' ? this._ircConnect() : this._wsConnect();
};

IRC.prototype.disconnect = function() {
  if(!this._connected) return;

  this._connected = false;
  this._socket.close();
};

IRC.prototype.reconnect = function() {
  if(this._connected) return;

  try {
    this._socket.close();
  } catch(e) { }

  delete this._socket;
  this.connect();
};

// IRC Parser

IRC.prototype._onOpen = function() {
  this._connected = true;
  if(this.options.pass) this.raw('PASS', this.options.pass);
  this.raw('NICK', this.options.nick);
  this.raw('CAP', 'REQ', ':twitch.tv/commands twitch.tv/tags');
  this.emit('connected');
};

IRC.prototype._onData = function(data) {
  var lines = data.toString().split('\r\n');

  if(this._buffer) {
    lines[0] = this._buffer + lines[0];
    this._buffer = null;
  }

  if(lines[lines.length - 1] !== '') {
    this._buffer = lines.pop();
  }

  for(var i = 0; i < lines.length; i++) {
    this._parse(lines[i]);
  }
};

IRC.prototype._parse = function(message) {
  message = parse(message);

  if(!message) return;

  if(message.command === 'PING') {
    this.raw('PONG', message.params.join(' '));
    return;
  }

  var data = {
    target: message.params.shift(),
    nick: message.prefix ? message.prefix.split('@')[0].split('!')[0] : undefined,
    tags: message.tags,
    message: message.params.shift(),
    raw: message.raw
  };

  this.emit(message.command.toLowerCase(), data);
}

IRC.prototype._onClose = function() {
  if(!this._connected) return;
  this._connected = false;
  this.emit('disconnected');
};

// IRC Commands

IRC.prototype._send = function() {
  if(!this._connected) return;

  if(this.options.protocol === 'irc') {
    this._socket.write(Array.prototype.join.call(arguments, ' ') + '\r\n');
  } else {
    this._socket.send(Array.prototype.join.call(arguments, ' ') + '\r\n');
  }
};

IRC.prototype.raw = IRC.prototype._send;

IRC.prototype.join = function(channel) {
  this._send('JOIN', channel);
};

IRC.prototype.part = function(channel) {
  this._send('PART', channel);
};

IRC.prototype.privmsg = function(channel, message) {
  this._send('PRIVMSG', channel, ':' + message);
};

module.exports = IRC;