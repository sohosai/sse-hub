var http = require('http'),
    events = require('events'),
    EventEmitter = events.EventEmitter;

var Router = require('router-line').Router;

var emitter = new EventEmitter();

var routes = new Router();

http.createServer(function (req, res) {
  var match = routes.route(req.method, req.url);
  if (match === undefined) {
    res.writeHead(404);
    res.end();
  } else {
    match.value(match.params, req, res);
  }
}).listen(process.env.PORT || 3000);

routes.GET('/api/streams/:stream_name/events', function (params, req, res) {
  var streamName = params['stream_name'];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('\n');

  function sendEvent (message) {
    if (message.hasOwnProperty('event')) {
      res.write('event: ' + message.event + '\n');
    }
    if (message.hasOwnProperty('data')) {
      res.write('data: ' + message.data + '\n');
    }
    res.write('\n');
  }

  function ping () {
    res.write(': ping\n\n');
  }

  var pingTimer = setInterval(ping, 10 * 1000);

  emitter.on(streamName, sendEvent);

  req.on('close', function () {
    emitter.removeListener(streamName, sendEvent);
    clearInterval(pingTimer);
  });
});

routes.POST('/api/streams/:stream_name/events', function (params, req, res) {
  var streamName = params['stream_name'];

  var buf = [];
  req.on('data', function (chunk) {
    buf.push(chunk);
  });
  req.on('end', function () {
    try {
      var message = JSON.parse(Buffer.concat(buf).toString());
      emitter.emit(streamName, message);
      res.end(JSON.stringify(message));
    } catch (err) {
      res.writeHead(500);
      res.end(err.toString());
    }
  });
});
