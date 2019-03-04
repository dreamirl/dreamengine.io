import SimpleSocket from './SimpleSocket';

function DESocket( url, options ) 
{
  SimpleSocket.call( this );

  this.options = {
    pingInterval: 5000,
    debug: false
  };
  
  options = options || {};
  for ( var i in options ) {
    this.options[ i ] = options[ i ];
  }
  this.url = url;

  this.connect();
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

  this._ws.onopen = () => this._onOpen();
  this._ws.onmessage = ( msg ) => this._onMessage( msg );
  this._ws.onclose = () => this._onClose.apply( this, arguments );
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

  this.onOpen();
};

DESocket.prototype._onMessage = function( msg ) {
  var parsed = JSON.parse( msg.data );

  if ( this._events[ parsed._ ] ) {
    this._events[ parsed._ ]( parsed.d, msg );
  }

  this.onMessage( parsed, msg );
};

DESocket.prototype._onClose = function() {
  if ( this.options.debug ) {
    console.log('socket disconnected', arguments);
  }

  // TODO add condition to see the reason and decide what to do correctly
  // for now the socket try to reconnect indefinitively
  setTimeout( this.connect, 1000 );
  
  this.onClose();
};

DESocket.prototype.send = function( msgName, value ) {
  if ( this.options.debug ) {
    console.log( 'sending', msgName, ': ', value );
  }

  this._ws.send( socketEncode( JSON.stringify( {
    _: msgName,
    d: value
  } ) ) );
}

function socketEncode(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

export default DESocket;