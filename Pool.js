/**
 * A simple implementation of Pool
 * This is to make it easier to do:
 * 'a socket join a pool and the can discuss as a private group'
 * very useful in a lot of situations
 *
 * @param {String} name
 */
function Pool(name) {
  this.id = name;

  this.sockets = [];
}
Pool.prototype.broadcast = function() {
  this.sockets.forEach((soc) => soc.send.apply(soc, arguments));
};
Pool.prototype.addSocket = function(socket) {
  this.sockets.push(socket);
  socket.pools.push(this.id);
};
Pool.prototype.removeSocket = function(socket) {
  this.sockets.splice(this.sockets.indexOf(socket), 1);
  socket.pools.splice(socket.pools.indexOf(this.id), 1);
};
Pool.prototype.removeAll = function() {
  this.sockets.forEach((soc) =>
    soc.pools.splice(soc.pools.indexOf(this.id), 1),
  );
  this.sockets = [];
};

// add a listener to every socket in this pool
// TODO if the socket leave the pool, the it should also stop listening the events
// registered from the pool (?)
Pool.prototype.listen = function(name, callback) {
  this.sockets.forEach((soc) => soc.listen(name, callback));
};

module.exports = Pool;
