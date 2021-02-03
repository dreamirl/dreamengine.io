const encode = require('@msgpack/msgpack').encode;

/**
 * A simple overlay over the native WebSocket to be more flexible
 * and ready to use
 *
 * @param {WebSocket} ws
 */

function SimpleSocket(ws) {
  this._ws = ws;
  this._manualClose = false;
  this.id = Date.now(); // imrpove this
  this._events = {};
  this.isDisconnected = false;

  this.options = {};
  this.customData = Object.assign({}, ws ? ws.customData || {} : {}); // store custom parameters, mostly dedicated to the game
  this.pools = []; // current joined pools

  this.onDisconnect = function() {
    /* override me plz */
  };
}
SimpleSocket.prototype.listen = function(name, callback) {
  if (this._events[name]) {
    console.warn('WARNING: Overriding the event ' + name);
  }
  this._events[name] = callback;
};
SimpleSocket.prototype.stopListening = function(name) {
  delete this._events[name];
};

SimpleSocket.prototype._destroy = function(ws, code, message) {
  delete this._ws;
  this._ws = null;
  for (var e in this._events) {
    delete this._events[e];
  }
  this._events = null;
};

SimpleSocket.prototype.send = function() {
  if (this.isDisconnected) {
    return;
  }

  var args = Array.prototype.slice.call(arguments);
  var eventName = args.shift();

  if (this.options.debug) {
    console.log('sending', eventName, ': ', args);
  }

  var encoded = encode({
    _: eventName,
    d: args,
  });

  this._ws.send(encoded, true);
};

// disconnect and close can be called even after the close event
// it can be a dev mistake but also the game-server won't wait for client to disconnect with an infinite time
// so the good practice is to send to client "please disconnect" and after X ms if it does not, kill it.
// Nb: this is a good practice because client make a difference with "connection lost" and "I left the server"
SimpleSocket.prototype.disconnect = function(code, shortMessage) {
  if (this.isDisconnected) {
    return;
  }
  this._manualClose = true;

  // https://unetworking.github.io/uWebSockets.js/generated/interfaces/websocket.html#end
  // end is undefined actually, why ??
  if (this._ws.end) {
    this._ws.end(code, shortMessage);
  } else {
    this._ws.close();
  }
};

SimpleSocket.prototype.close = function() {
  if (this.isDisconnected) {
    return;
  }
  this._manualClose = true;
  this._ws.close();
};

module.exports = SimpleSocket;
