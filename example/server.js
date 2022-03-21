const deio = require('../de.io');

// this detect when a new connection appear
deio.onConnection = function (socket, request) {
  var nickname = 'guest' + socket.id.toString().slice(8, 12);

  // this is only attached to  this specific socket
  socket.listen('chat', (d) => {
    if (d.p) {
      d.op = nickname;
      nickname = d.p;
      d.nn = 1;
    }
    d.p = nickname;
    deio.broadcast('chat', d);
  });

  socket.ondisconnect = function () {
    deio.broadcast('ds', { p: nickname });
  };

  deio.broadcast('chat', { p: nickname, m: '', j: 1 });
};

// this is globally registered
// for any socket that is already or will be connected
deio.listen('chat', (socket, data) => {});

deio.startApp(9000, { ssl: false });
