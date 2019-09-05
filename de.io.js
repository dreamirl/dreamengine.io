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
const uWS = require( 'uWebSockets.js' );
const SimpleSocket = require( './SimpleSocket' );
const Pool = require( './Pool' );

const UPDATE_PLAYERS_ONLINE = "upo";

const deio = {
  _connectedSockets: {},
  _events: {},
  _app: null,
  options: {
    useJSON: true
  },
  connectionCount: 0,

  _pools: {},
  
  onConnection: function(){ /* override me plz */ },

  _registerSocket: function( ws, req ) {
    this.connectionCount++;
    const soc = new SimpleSocket( ws );
    this._connectedSockets[ soc.id ] = soc;
    ws.id = soc.id;
    soc.send( '1', soc.id );
    this.onConnection( soc, req );
    this.broadcast( UPDATE_PLAYERS_ONLINE, this.connectionCount );
  },

  _closeSocket: function( ws, code, message ) {
    this.connectionCount--;
    this._connectedSockets[ ws.id ].isDisconnected = true;
    this._connectedSockets[ ws.id ].onDisconnect( ws );
    this._connectedSockets[ ws.id ]._destroy( ws, code, message );
    delete this._connectedSockets[ ws.id ];
    delete ws.id;
    this.broadcast( UPDATE_PLAYERS_ONLINE, this.connectionCount );
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
      this._events[ msg._ ].apply( this, [ socket ].concat( msg.d ) );
    }

    if ( socket._events[ msg._ ] ) {
      socket._events[ msg._ ].apply( socket, msg.d );
    }
  },

  listen: function( name, callback ) {
    if ( this._events[ name ] ) {
      console.warn( 'WARNING: Overriding the event ' + name );
    }
    this._events[ name ] = callback;
  },

  // need pools like in socket.io
  joinPool: function( poolName, socket ) {
    if ( !this._pools[ poolName ] ) {
      this._pools[ poolName ] = new Pool( poolName );
    }
    this._pools[ poolName ].addSocket( socket );
  },

  leavePool: function( poolName, socket ) {
    if ( !this._pools[ poolName ] ) {
      return;
    }
    this._pools[ poolName ].removeSocket( socket );
  },

  removePool: function( poolName ) {
    if ( !this._pools[ poolName ] ) {
      return;
    }
    delete this._pools[ poolName ]
  },

  poolExists: function( poolName ) {
    return !!this._pools[ poolName ];
  },

  pool: function( poolName ) {
    if ( !this._pools[ poolName ] ) {
      console.warn( 'WARNING: You tried to get a pool that does not exist. Creating an empty pool to prevent code crash. PoolName is: ' + poolName );
      this._pools[ poolName ] = new Pool( poolName );
    }
    return this._pools[ poolName ];
  },

  // send to all connected ws
  broadcast: function() {
    for ( var i in this._connectedSockets ) {
      this._connectedSockets[ i ].send.apply( this._connectedSockets[ i ], arguments );
    }
  },

  startApp: function( port, options ) {
    this._app = uWS[ options.ssl ? 'SSLApp' : 'App' ]( {
      key_file_name: options.key_perm,
      cert_file_name: options.cert_perm,
      passphrase: options.ssl_pwd
    } )
    // TODO should be possible to add as many as we wants
    .ws('/*', {
      /* Options */
      compression: options.compression || 0,
      maxPayloadLength: options.maxPayloadLength || 16 * 1024 * 1024,
      idleTimeout: options.idleTimeout || 10,
      /* Handlers */
      open: ( ws, req ) => {
        console.log( 'A WebSocket connected via URL: ' + req.getUrl() );

        // looks like sockets have no id or hash
        // need to create it and store it
        deio._registerSocket( ws, req );
      },
      message: ( ws, binaryMsg, isBinary ) => {
        var parsed = String.fromCharCode.apply( null, new Uint16Array( binaryMsg ) );
        if ( parsed === '1' ) {
          // just ping
          return;
        }
    
        // console.log('message received from ' + ws.id, binaryMsg, isBinary, parsed);
        deio._onMessageEnter( ws, parsed, binaryMsg );
        
        // TODO
        /* Ok is false if backpressure was built up, wait for drain */
        // let ok = ws.send(message, isBinary);
      },
    
      // not sure what is this for lol
      drain: (ws) => {
        console.log( 'WebSocket backpressure: ' + ws.getBufferedAmount() );
      },
    
      close: ( ws, code, message ) => {
        deio._closeSocket( ws, code, message );
      }
    })
    // TODO, should be able to listen severals and customized routes
    .any( '/*', ( res, req ) => {
      res.end( 'Nothing to see here!' );
    } )
    .listen( port, ( token ) => {
      if ( token ) {
        console.log( 'Listening to port ' + port );
      } else {
        console.log( 'Failed to listen to port ' + port );
      }
    } );
  }
};

module.exports = deio;
