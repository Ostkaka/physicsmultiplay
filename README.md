# Physics multiplayer demo

This is simple a demo for a multiplayer physics playground based on 
[three.js](https://github.com/mrdoob/three.js), [cannon.js](https://github.com/schteppe/cannon.js),
 and [node.js](http://nodejs.org/).

The scene features multi-user interactions such as:

 * Object spawning (boxes and spheres).
 * Mouse picking (Pick and throw objects around with the mouse).
 * Apply a point gravity field.
 * Chat with other players

Server-client communication is done using WebSockets with packets in JSON text-format. Simulation is done serverside only, while clients handle rendering.

[Live demo at nodejitsu](http://pmb.jit.su/)

### Installation and Usage

To install, clone the repository and do:

    apt-get install nodejs
    cd physicsmultiplay
    npm install
    node cannon_server.js

point your browser to the IP and enter a name.

Note: to change the default port 80, you have to change it in both cannon_server.js and cannon_client.js.


![.](http://content.screencast.com/users/dirkk1/folders/Jing/media/04ebcfa3-0870-4fc7-acfc-f954a0bba492/00000090.png)

## Ideas and Todos
* Support convex shapes. Teapots and rabbits mandatory.
* Send update of an entity to clients only if has been changed.
* Improved mouse-pick rendering.
* Render mouse picks of other clients.
* Binary packets instead of text.
* Limit number of players.
