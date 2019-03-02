var socket = null;
var chat = document.getElementById('chat');

var tries = 0;
function connect() {
  chat = document.getElementById('chat');
  var input = document.getElementById('input');
  var nick = document.getElementById('nick');
  var btn = document.getElementById('btn');
  
  btn.onclick = function() {
    var  d = {
      m: input.value,
      p: nick.value
    };
    send( 'chat', d );
    input.value = '';
  }

  socket = new WebSocket('ws://localhost:9000');
  // socket.binaryType = 'arraybuffer';
  socket.onopen = function() {
    console.log('connection open');
    tries = 0;
  }
  socket.onmessage = handleReceive;
  socket.onclose = function() {
    console.log('disconnected because: ', arguments);

    ++tries;
    if ( tries > 20 ) {
      console.error( 'To many tentatives to connect' );
      return;
    }
    setTimeout( connect, 1000 );
  }
  setInterval(function() {
    if ( socket.readyState !== socket.OPEN ) {
      return;
    }
    socket.send(str2ab('1'));
  }, 500);

};

function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function send(msgName, value) {
  console.log('sending', msgName, ': ', value)
  socket.send( str2ab( JSON.stringify( {
    _: msgName,
    d: value
  } ) ) );
} 

function handleReceive(message) {
  // 受信したRAWデータをcanvasに
  console.log(message);
  // var c = resultCanvas = document.getElementById('result');
  // var ctx = c.getContext('2d');
  // var imageData = ctx.createImageData(200, 200);
  // var pixels = imageData.data;

  // var buffer = new Uint8Array(message.data);
  // for (var i=0; i < pixels.length; i++) {
  //   pixels[i] = buffer[i];
  // }
  // ctx.putImageData(imageData, 0, 0);

  var parsed = JSON.parse( message.data );
  // en vrai un truc comme au back ce sera mieux hein, maibon
  switch( parsed._ ) {
    case 'chat':
      receiveChat( parsed.d );
      break;
    
    case 'ds':
      chat.innerHTML += '<br/><i>' + parsed.d.p + ' left</i>';''
      break;
  }
}

function receiveChat( data ) {
  var txt = '<br /><b>' + data.p + '</b>: ' + data.m;

  if ( data.nn ) {
    txt = '<br /><i>' + data.op + ' changed nick to ' + data.p + '</i>' + txt;
  }
  if ( data.j ) {
    txt = '<br /><i>' + data.p + ' joined the world</i>';
  }

  chat.innerHTML += txt;
}