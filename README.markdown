#Physics Multiplay

This is  simple a demo for a multiplayer physics playground based on [three.js](https://github.com/mrdoob/three.js), [cannon.js](https://github.com/schteppe/cannon.js), and [node.js](http://nodejs.org/).

The scene features multi user interactions such as:

 * Object spawning (boxes and spheres).
 * Mouse picking (Pick and throw objects around with the mouse).
 * Apply a point gravity field.

Server-client communication is done using WebSockets with packets in JSON text-format. Simulation
in done serverside only, while clients handle rendering and sending user events.

[Live demo on nojitsu](http://pmb.jit.su/)

### How to use

Install node.js on nodejs.org. 

Install all the node packages using NPM by running
```
npm install -d
```
in the app directory to install all dependencies globaly.

Start the app by running
```
node cannon_server.js
```
in the app directory. This should be all that is required to start a server.

Play and have fun! Invite your friends, throw spheres, and spawn boxes until the server melts! 