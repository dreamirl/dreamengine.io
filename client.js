import { decode } from '@msgpack/msgpack';
import { encode } from '@msgpack/msgpack';
import SimpleSocket from './SimpleSocket';

function DESocket(url, options) {
  SimpleSocket.call(this);

  this.id = null; // automatically pushed by server
  this.options = {
    pingInterval: 500,
    debug: false,
  };
  this.pingRecords = [];
  this.bufferSize = 6;

  options = options || {};
  for (var i in options) {
    this.options[i] = options[i];
  }
  this.url = url;

  this.listen('id', (id) => (this.id = id));
  return this;
}

DESocket.prototype = new SimpleSocket();
DESocket.constructor = DESocket;
DESocket.supr = SimpleSocket.prototype;

// to override
DESocket.prototype.onOpen = function () {};
DESocket.prototype.onMessage = function () {};
DESocket.prototype.onClose = function () {};

DESocket.prototype.connect = function (url) {
  url = url || this.url;

  this._ws = new WebSocket(url);
  this.url = url;
  this.id = null;
  this._open = false;

  this._ws.onopen = () => this._onOpen();
  this._ws.onmessage = (msg) => this._onMessage(msg);
  this._ws.onclose = (event) => this._onClose(event);
};

DESocket.prototype.onUpdatePing = () => {};

DESocket.prototype.checkPing = function () {
  if (this._ws.readyState !== this._ws.OPEN) {
    return;
  }
  this._ws.send(encode({ _: 'ping', d: [Date.now()] }));
};

DESocket.prototype._onOpen = function () {
  if (this.options.debug) {
    console.log('socket connected');
  }

  clearInterval(this.pingInterval);
  this.pingInterval = setInterval(
    () => this.checkPing(),
    this.options.pingInterval,
  );

  if (!this._open) {
    this._open = true;
    this.onOpen();
  }
};

DESocket.prototype._updatePing = function (oldTimeStamp) {
  var delay = Date.now() - oldTimeStamp;
  this.latestPing = delay;
  this.pingRecords.push(delay);
  if (this.pingRecords.length > this.bufferSize) {
    this.pingRecords.splice(0, this.pingRecords.length - this.bufferSize);
  }
  this.medianPing = Math.floor(
    this.pingRecords.reduce((a, b) => a + b) / this.pingRecords.length,
  );
  this.onUpdatePing(this.latestPing, this.medianPing);
};

DESocket.prototype._onMessage = function (msg) {
  var reader = new FileReader();
  reader.addEventListener('loadend', () => {
    var obj = decode(reader.result);

    //console.log(JSON.stringify(obj));

    if (obj._ == 'ping') {
      this._updatePing(obj.d[0]);
    } else if (this._events[obj._]) {
      this._events[obj._].apply(this, obj.d);
    }

    this.onMessage(obj);
  });
  reader.readAsArrayBuffer(msg.data);
};

DESocket.prototype._onClose = function (event) {
  if (this.options.debug) {
    console.log('socket disconnected', arguments);
  }

  if (this._open) {
    this._open = false;
    this.onClose(event);
  }

  // if the socket is not tagged as "_manualClose", it will try to reconnect indefinitively
  /*if (!this._manualClose) {
    setTimeout(() => this.connect(), 1000);
  }*/
};

// only one way to disconnect on front
DESocket.prototype.disconnect = SimpleSocket.prototype.close;

export default DESocket;
