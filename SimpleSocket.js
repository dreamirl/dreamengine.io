/**
 * A simple overlay over the native WebSocket to be more flexible
 * and ready to use
 * 
 * @param {WebSocket} ws 
 */
const socketEncode = require( './socketEncode' );

function SimpleSocket(ws) {
  this._ws = ws;
  this.id = Date.now(); // imrpove this
  this._events = {};
  this.isDisconnected = false;

  this.options = {};
  this.customData = {}; // store custom parameters, mostly dedicated to the game

  this.ondisconnect = function(){ /* override me plz */ };
}
SimpleSocket.prototype.listen = function( name, callback ) {
  if ( this._events[ name ] ) {
    console.warn( 'WARNING: Overriding the event ' + name );
  }
  this._events[ name ] = callback;
};
SimpleSocket.prototype.stopListening = function( name ) {
  delete this._events[ name ];
};

SimpleSocket.prototype._destroy = function( ws, code, message ) {
  delete this._ws;
  for ( var e in this._events ) {
    delete this._events[ e ];
  }
  this._events = null;
};

SimpleSocket.prototype.send = function() {
  if ( this.isDisconnected ) {
    return;
  }

  var args = Array.prototype.slice.call( arguments );
  var eventName = args.shift();

  if ( this.options.debug ) {
    console.log( 'sending', eventName, ': ', args );
  }
  var str = socketEncode( JSON.stringify( {
    _: eventName,
    d: args
  } ) );
  this._ws.send( str, true );
}

module.exports = SimpleSocket;
