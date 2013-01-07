$(function () {
    "use strict"

    // for better performance - to avoid searching in DOM
    var gconsole = new GConsole('content',10,20);
    var input = $('#input');
    var nameboxinput = $('#nameboxinput');
    var namebox = $('#namebox');
    var namebox2 = document.getElementById("namebox");
    var nameboxtext = $('#nameboxtext');
    var status = $('#status');
 
    // my color assigned by the server
    var clientColor = false;

    // my name sent to the server
    var clientName = false;

    // if user is running mozilla then use it's built-in WebSocket
    window.WebSocket = window.WebSocket || window.MozWebSocket;

   // if browser doesn't support WebSocket, just show some notification and exit
    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
                                    + 'support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }

    // Establish connection with server
    var serverAdress1 = "ws://192.168.1.73:3000"
    var serverAdress2 = "ws://localhost:3000"

    var serverConnection = new WebSocket(serverAdress1);

    serverConnection.onopen = function () {
        // connection is opened and ready to use
        // Get user name
        input.removeAttr('disabled');
        nameboxinput.removeAttr('disabled');
        nameboxtext.text('Choose name');
    };

    serverConnection.onerror = function (error) {
        // an error occurred when sending/receiving data

        content.html($('<p>', { text: 'Error in connection or the server is down.' + error.reason + '</p>' } ));

    };

    serverConnection.onmessage = function (message) {

        // try to parse json (assume information from server is json)
        try {
            var jsonData = JSON.parse(message.data);
        } catch (e) {
            console.log('Not JSON format! : ', message.data);
            return;
        }

        // handle incoming message
        if(jsonData.type === 'color') {
            clientColor = jsonData.color;
            // Make so that user can send messages
            input.removeAttr('disabled').focus();

        }else if (jsonData.type === 'history') { //send whole history
            // insert every single message to the chat window
            for (var i=0; i < jsonData.data.length; i++) {
                addMessage(jsonData.data[i].author, 
                    jsonData.data[i].text,
                    jsonData.data[i].color, 
                    new Date(jsonData.data[i].time));
            }

        } else if (jsonData.type === 'message') { // This is a single text message
            input.removeAttr('disabled'); // let the user write another message
            addMessage(jsonData.data.author, 
                        jsonData.data.text,
                       jsonData.data.color, 
                       new Date(jsonData.data.time));

        } else {
            console.log('JSON data type not supported! Bail for FAIL!', json);
        }
    };

    /**
     * Send mesage when user presses Enter key
     */
    input.keydown(function(e) {
        //dafuq Enter = 13? 
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            // send text message
            serverConnection.send(msg);
            $(this).val('');

            // disable the input field to make the user wait until server
            // Hold yer horses
            input.attr('disabled', 'disabled');
 
            // First message is always a name. Always
            if (clientName === false) {
                clientName = msg;
            }
        }
    });

    /**
     * Send name when user presses Enter key. Then remove the 
     * name div
     */
    nameboxinput.keydown(function(e) {
        //dafuq Enter = 13? 
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            // send text message
            serverConnection.send(msg);
            $(this).val('');

            // disable the input field to make the user wait until server
            // Hold yer horses
            nameboxinput.attr('disabled', 'disabled');

            //Remove the namebox div
            namebox.detach();

            // First message is always a name. Always
            if (clientName === false) {
                clientName = msg;
            }
        }
    });

    /**
     * This method is optional. If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong.
     */
    setInterval(function() {
        if (serverConnection.readyState !== 1) {
            gconsole.println('Error: Unable to comminucate with server');
            input.attr('disabled', 'disabled').val('Unable to comminucate '
                                                 + 'with the server.');
            nameboxinput.attr('disabled', 'disabled').val('Unable to comminucate '
                                                 + 'with the server.');
        }
    }, 3000);

    /**
     * Add message to the chat window
     */
    function addMessage(author, message, color, date) {
        var datestr = '[' + (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':'
             + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ']';

        /*gconsole.simplePrint('<p>' + '[' + datestr + ']   ' + '<span style="color:' + color + '">'
        + '[' + author + ']: ' + message + '</span> </p>')*/
        gconsole.println(datestr + '  ' + '[' + author + ']: ' + message,color);    
    }

    // Get keycode for the press
    function getKeyCode(e){
        e= window.event || e;
        e= e.charCode || e.keyCode;
        return e;
    }

    // Add event listener for the chat
    window.addEventListener("keydown",function(e){        // Set the focus to the input div in the console
        //Get keycode
        var keycode = getKeyCode(e)
        // Check if "t" is pressed
        if(clientName !== false && keycode == 84)
            input.focus();
    });

});