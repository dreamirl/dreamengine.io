/**
 * DreamEngine.io
 * A WebSockets implementation designed for super-high-performance cases
 * It is build over 'uWebSockets', the most  powerful ws implementation.
 * 
 * Implementation highly inspired by sockets.io
 * 
 * It is not designed to support everything with every fallbacks possible
 * 
 * WARNING: this is currently a DRAFT project
 * TODO:
 * - redis sessions implementation
 * - pools implementations (joint pool, emit in pool, leave pool)
 * - client standardized implementation, served by the server
 * - DreamEngine backend logics?
 */
const uWS = require('uWebSockets.js');

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



const deio = {
  _connectedSockets: {},
  _events: {},
  _app: null,
  options: {
    useJSON: true
  },
  
  onConnection: function(){ /* override me plz */ },

  _registerSocket: function( ws, req ) {
    const soc = new SimpleSocket( ws );
    this._connectedSockets[ soc.id ] = soc;
    ws.id = soc.id;
    this.onConnection( soc, req );
  },

  _closeSocket: function( ws, code, message ) {
    this._connectedSockets[ ws.id ].isDisconnected = true;
    this._connectedSockets[ ws.id ].ondisconnect();
    this._connectedSockets[ ws.id ]._destroy( ws, code, message );
    delete this._connectedSockets[ ws.id ];
    delete ws.id;
    console.log( 'WebSocket closed and cleaned', code, message );
  },

  _onMessageEnter: function( ws, strMsg, binaryMsg ) {
    var msg = strMsg;
    
    if ( this.options.useJSON ) {
      msg = JSON.parse(strMsg); 
    }
    else {
      // TODO no JSON = no message name, just one big function custom made
      return;
    }

    var socket = this._connectedSockets[ ws.id ];

    if ( this._events[ msg._ ] ) {
      this._events[ msg._ ]( socket, msg.d );
    }

    if ( socket._events[ msg._ ] ) {
      socket._events[ msg._ ]( msg.d );
    }
  },

  listen: function( name, callback ) {
    if ( this._events[ name ] ) {
      console.warn( 'WARNING: Overriding the event ' + name );
    }
    this._events[ name ] = callback;
  },

  // need pools like in socket.io
  pool: function(  poolId ) {

  },

  // send to all connected ws
  spread: function( msgName, data ) {
    for ( var i in this._connectedSockets ) {
      this._connectedSockets[ i ].send( { _: msgName, d: data } );
    }
  },

  startApp: function( port, options ) {
    this._app = uWS[ options.ssl ? 'SSLApp' : 'App' ]({
      key_file_name: options.key_perm,
      cert_file_name: options.cert_perm,
      passphrase: options.ssl_pwd
    })
    // should be possible to add as many as we wants
    .ws('/*', {
      /* Options */
      compression: options.compression || 0,
      maxPayloadLength: options.maxPayloadLength || 16 * 1024 * 1024,
      idleTimeout: options.idleTimeout || 7,
      /* Handlers */
      open: (ws, req) => {
        console.log('A WebSocket connected via URL: ' + req.getUrl());

        // looks like sockets have no id or hash
        // need to create it and store it
        deio._registerSocket(ws, req);
      },
      message: (ws, binaryMsg, isBinary) => {
        var parsed = String.fromCharCode.apply(null, new Uint16Array(binaryMsg));
        if (parsed === '1') {
          // just ping
          return;
        }
    
        // console.log('message received from ' + ws.id, binaryMsg, isBinary, parsed);
        deio._onMessageEnter(ws, parsed, binaryMsg);
        
        // TODO
        /* Ok is false if backpressure was built up, wait for drain */
        // let ok = ws.send(message, isBinary);
      },
    
      // not sure what is this for lol
      drain: (ws) => {
        console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
      },
    
      close: (ws, code, message) => {
        deio._closeSocket( ws, code, message );
      }
    })
    .any('/*', (res, req) => {
      res.end('Nothing to see here!');
    })
    .listen(port, (token) => {
      if (token) {
        console.log('Listening to port ' + port);
      } else {
        console.log('Failed to listen to port ' + port);
      }
    });    
  }
}

module.exports = deio;
