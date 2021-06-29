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
const SimpleSocket = require('./SimpleSocket');
const Pool = require('./Pool');
const decode = require('@msgpack/msgpack').decode;
const encode = require('@msgpack/msgpack').encode;

const deio = {
  _connectedSockets: {},
  _events: {},
  _app: null,
  options: {
    useJSON: true,
  },
  connectionCount: 0,

  _pools: {},

  onUpgrade: async function(requestData) {
    return true;
  },

  onConnection: function() {
    /* override me plz */
  },

  _upgradeSocket: async function(res, req, context) {
    const upgradeAborted = { aborted: false };
    res.onAborted(() => {
      /* We can simply signal that we were aborted */
      upgradeAborted.aborted = true;
    });

    const reqData = {
      query: req.getQuery(),
      url: req.getUrl(),
    };

    const secWebSocketKey = req.getHeader('sec-websocket-key');
    const secWebSocketProtocol = req.getHeader('sec-websocket-protocol');
    const secWebSocketExtensions = req.getHeader('sec-websocket-extensions');

    try {
      const userData = await this.onUpgrade(reqData);
      if (userData && !upgradeAborted.aborted) {
        return res.upgrade(Object.assign({
            url: reqData.url,
          }, userData),
          /* Spell these correctly */
          secWebSocketKey,
          secWebSocketProtocol,
          secWebSocketExtensions,
          context
        );
      }
      console.error('Unable to upgrade the socket:: noData or user aborted');
      if (!upgradeAborted.aborted) {
        res.end('NO DATA');
      }
    } catch (e) {
      console.error('Unable to upgrade the socket::', e);
      res.end(e);
    }
  },

  _registerSocket: function(ws) {
    this.connectionCount++;
    const soc = new SimpleSocket(ws);
    this._connectedSockets[soc.id] = soc;
    ws.id = soc.id;
    soc.send('id', ws.id);
    this.onConnection(soc);
  },

  _closeSocket: function(ws, code, message) {
    if (!this._connectedSockets[ws.id]) return console.error("WebSocket tried to be closed but doesn't exists");
    this.connectionCount--;
    this._connectedSockets[ws.id].pools.forEach((pName) =>
      this.leavePool(pName, this._connectedSockets[ws.id]),
    );
    this._connectedSockets[ws.id].isDisconnected = true;
    this._connectedSockets[ws.id].onDisconnect(ws);
    this._connectedSockets[ws.id]._destroy(ws, code, message);
    delete this._connectedSockets[ws.id];
    delete ws.id;
    console.log('WebSocket closed and cleaned', code, message);
  },

  _respondToPing: function(socket, obj) {
    var encoded = encode(obj);
  
    socket.send(encoded, true);
  },

  _onMessageEnter: function(ws, obj) {
    var socket = this._connectedSockets[ws.id];

    if(obj._ == "ping") {
      this._respondToPing(ws, obj);
    } else {
      if (this._events[obj._]) {
        this._events[obj._].apply(this, [socket].concat(obj.d));
      }
  
      if (socket._events[obj._]) {
        socket._events[obj._].apply(socket, obj.d);
      }
    }
  },

  listen: function(name, callback) {
    if (this._events[name]) {
      console.warn('WARNING: Overriding the event ' + name);
    }
    this._events[name] = callback;
  },

  createPool: function(poolName) {
    if (this._pools[poolName]) {
      console.error(
        'deio createPool, the pool ' + poolName + ' already exists',
      );
      return Promise.reject('pool_exists');
    }
    this._pools[poolName] = new Pool(poolName);
    return Promise.resolve(this._pools[poolName]);
  },

  // need pools like in socket.io
  joinPool: function(poolName, socket) {
    if (!this._pools[poolName]) {
      this._pools[poolName] = new Pool(poolName);
    }
    this._pools[poolName].addSocket(socket);
  },

  leavePool: function(poolName, socket) {
    if (!this._pools[poolName]) {
      return;
    }
    this._pools[poolName].removeSocket(socket);
  },

  removePool: function(poolName) {
    if (!this._pools[poolName]) {
      return;
    }
    delete this._pools[poolName];
  },

  poolExists: function(poolName) {
    return !!this._pools[poolName];
  },

  pool: function(poolName) {
    if (!this._pools[poolName]) {
      console.warn(
        'WARNING: You tried to get a pool that does not exist. Creating an empty pool to prevent code crash. PoolName is: ' +
          poolName,
      );
      this._pools[poolName] = new Pool(poolName);
    }
    return this._pools[poolName];
  },

  // send to all connected ws
  broadcast: function() {
    for (var i in this._connectedSockets) {
      this._connectedSockets[i].send.apply(
        this._connectedSockets[i],
        arguments,
      );
    }
  },

  startApp: function(port, options) {
    this._app = uWS[options.ssl ? 'SSLApp' : 'App']({
      key_file_name: options.key_perm,
      cert_file_name: options.cert_perm,
      passphrase: options.ssl_pwd,
    })
      // TODO should be possible to add as many as we wants
      .ws('/*', {
        /* Options */
        compression: options.compression || 0,
        maxPayloadLength: options.maxPayloadLength || 16 * 1024 * 1024,
        idleTimeout: options.idleTimeout || 10,
        /* Handlers */
        upgrade: (res, req, context) => {
          console.log('A WebSocket connected via URL: ', req.getUrl());

          deio._upgradeSocket(res, req, context);
        },
        // after upgrade event
        open: (ws) => {

          // looks like sockets have no id or hash
          // need to create it and store it
          deio._registerSocket(ws);
        },
        message: (ws, binaryMsg, isBinary) => {
          var obj = decode(binaryMsg);

          //console.log(JSON.stringify(obj));

          deio._onMessageEnter(ws, obj);

          // TODO
          /* Ok is false if backpressure was built up, wait for drain */
          // let ok = ws.send(message, isBinary);
        },

        // not sure what is this for lol
        drain: (ws) => {
          console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
        },

        close: (ws, code, message) => {
          deio._closeSocket(ws, code, message);
        },
      })
      // TODO, should be able to listen severals and customized routes
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
  },
};

module.exports = deio;
