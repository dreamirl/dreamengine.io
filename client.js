import SimpleSocket from './SimpleSocket';
import socketEncode from './socketEncode';

function DESocket( url, options ) 
{
  SimpleSocket.call( this );

  this.id = null; // automatically pushed by server
  this.options = {
    pingInterval: 5000,
    debug: false
  };
  
  options = options || {};
  for ( var i in options ) {
    this.options[ i ] = options[ i ];
  }
  this.url = url;

  this.listen( '1', id => this.id = id );
  return this;
}

DESocket.prototype = new SimpleSocket();
DESocket.constructor = DESocket;
DESocket.supr = SimpleSocket.prototype;

// to override
DESocket.prototype.onOpen = function(){};
DESocket.prototype.onMessage = function(){};
DESocket.prototype.onClose = function(){};

DESocket.prototype.connect = function( url ) {
  url = url || this.url;

  this._ws = new WebSocket( url );
  this.url = url;
  this.id = null;
  this._manualClose = false;
  this._open = false;

  this._ws.onopen = () => this._onOpen();
  this._ws.onmessage = ( msg ) => this._onMessage( msg );
  this._ws.onclose = () => this._onClose.apply( this, arguments );
};

DESocket.prototype.disconnect = function() {
  this._manualClose = true;
  if( this._ws ) {
    this._ws.close();
  }
};

DESocket.prototype.keepAlive = function() {
  if ( this._ws.readyState !== this._ws.OPEN ) {
    return;
  }
  this._ws.send( socketEncode( '1' ) ); // ping
}

DESocket.prototype._onOpen = function() {
  if ( this.options.debug ) {
    console.log( 'socket connected' );
  }

  
  clearInterval( this.pingInterval );
  this.pingInterval = setInterval( () => this.keepAlive(), this.options.pingInterval );
  
  if(!this._open) {
    this._open = true;
    this.onOpen();
  }
};

DESocket.prototype._onMessage = function( msg ) {
  var reader = new FileReader();
  reader.addEventListener( 'loadend', () => {
    var readable = String.fromCharCode.apply( null, new Uint16Array( reader.result ) );
    var parsed = JSON.parse( readable );

    if ( this._events[ parsed._ ] ) {
      this._events[ parsed._ ].apply( this, parsed.d );
    }

    this.onMessage( parsed, msg );
  } );
  reader.readAsArrayBuffer( msg.data );
};

DESocket.prototype._onClose = function() {
  if ( this.options.debug ) {
    console.log('socket disconnected', arguments);
  }

  // TODO add condition to see the reason and decide what to do correctly
  // for now the socket try to reconnect indefinitively
  if ( !this._manualClose ) {
    setTimeout( () => this.connect(), 1000 );
  }
  
  if(this._open) {
    this._open = false;
    this.onClose();
  }
};

export default DESocket;