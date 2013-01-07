
/**
 * Module dependencies.
 */

"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

var defaultPort = 3000;

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path') 
  , WebSocketServer = require('websocket').server
  , Buffer = require('buffer').Buffer;
  
var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || defaultPort);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// Get requests
app.get('/', function(request, response){
    response.render('index');
});

/*
* Other server depedencies
*/
var jQuery = require('./public/js/jquery-extend.js');
Object.extend = jQuery.extend; // box2d.js needs Object.extend

/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
 
// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

/**
 * Global variables
 */
// latest 100 messages
var chatHistory = [ ];
// list of currently connected clients (users)
var clients = [ ];

/**
 * Start HTTP server
 */
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

/**
 * Tie Web socket server in httpserver
 */
var wsServer = new WebSocketServer({
  httpServer: server
});

/*
* Server request function
*/
wsServer.on('request', function(request) {
    // Log when someone connects to the to the websocket server
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // Accept connection
    var connection = request.accept(null, request.origin);

    // we need to know client index to remove them on 'close' event
    var index = clients.push(connection) - 1;
    var userName = false;
    var userColor = false;
 
    console.log((new Date()) + ' Connection accepted.');

    // Send chat history to connected user with JSON
    if (chatHistory.length > 0) {
        connection.sendUTF(JSON.stringify( { type: 'history', data: chatHistory} ));
    }

    // This is the most important callback for us, we'll handle
    // all messages from users here.
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            // process WebSocket message
             if (userName === false) {  /// Always send the username first 
                // remember user name
                userName = htmlEntities(message.utf8Data);
                // get random color and send it back to the user
                userColor = colors.shift();
                connection.sendUTF(JSON.stringify({ type:'color', data: userColor }));
                console.log((new Date()) + ' User is known as: ' + userName
                            + ' with ' + userColor + ' color.');

             } else { // User has a name, so this is a message. Broadcast the message then

                var message = {
                  time: (new Date()).getTime(),
                  text: htmlEntities(message.utf8Data),
                  author: userName,
                  color: userColor
                };
                chatHistory.push(message);
                chatHistory = chatHistory.slice(-100);

                // broadcast message to all connected clients
                var json = JSON.stringify({ type:'message', data: message });
                for (var i=0; i < clients.length; i++) {
                    clients[i].sendUTF(json);
                }
             }
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            colors.push(userColor);
        }
    });
});
