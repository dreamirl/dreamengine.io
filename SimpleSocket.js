/**
 * A simple overlay over the native WebSocket to be more flexible
 * and ready to use
 * 
 * @param {WebSocket} ws 
 */
function SimpleSocket(ws) {
  this._ws = ws;
  this.id = Date.now(); // imrpove this
  this._events = {};
  this.isDisconnected = false;

  this.ondisconnect = function(){ /* override me plz */ };
}
SimpleSocket.prototype.listen = function( name, callback ) {
  if ( this._events[ name ] ) {
    console.warn( 'WARNING: Overriding the event ' + name );
  }
  this._events[ name ] = callback;
};
SimpleSocket.prototype.send = function( data ) {
  if ( this.isDisconnected ) {
    return;
  }
  
  this._ws.send( JSON.stringify( data ) );
};
SimpleSocket.prototype._destroy = function( ws, code, message ) {
  delete this._ws;
  for ( var e in this._events ) {
    delete this._events[ e ];
  }
  this._events = null;
};

module.exports = SimpleSocket;
