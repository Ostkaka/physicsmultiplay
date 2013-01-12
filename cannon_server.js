/**
 * Server-side script for the cannon multiplayer game
 */

"use strict";

// Process title
process.title = 'PhysicsMultiplay';

var defaultPort = 80;

// Do some requirements that I do not understand
var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path') 
  , WebSocketServer = require('websocket').server
  , Buffer = require('buffer').Buffer;
  
var app = express();

// Configure stuff...
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

// I do not know what this is
app.configure('development', function(){
  app.use(express.errorHandler());
});

/***********************************************************************
* Send the HTML page to render when client connects to the servers
************************************************************************/
app.get('/', function(request, response){
    response.render('client_index');
});

/**************************
* Get dependencies
***************************/
var jQuery = require('./public/js/jquery-extend.js');
Object.extend = jQuery.extend; // box2d.js needs Object.extend
var CANNON = require('./public/js/cannon.js');
var util = require('./public/js/utility.js');

/**********************************************************************
 * Start HTTP server and WebSockets
 **********************************************************************/
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

/**
 * Tie Web socket server in httpserver
 */
var wsServer = new WebSocketServer({
  httpServer: server
});

/**********************************************************************
* Define global variables
***********************************************************************/

var DEBUG_LOG = false;

/*
* Define cannon world
*/
var cannonWorld = false;
var dt = 1/60;
var physicsMaterial = false;
var sphereShape, sphereBody;
var numBodies = 0;
/*
* Define object arrays in the cannon world
*/
// This is an associtive array for entities in the simulation
// Each cannon entity is associated with an id number
var nunmConnections = 0;
var cannonEntities = {};
var clientConnections = {};
var clientInformation = {};
var colors = generateColors();

/******************************************************************
* Define start of server
******************************************************************/
initCannon();
createScene();

/**********************************************************************
* Server request function and the connections function
***********************************************************************/
wsServer.on('request', function(request) {

    // Log when someone connects to the to the websocket server
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // Accept connection
    var connection = request.accept(null, request.origin);

    /************************************************************
    * Show indipendent server information for each client here
    *************************************************************/
    //var clientIndex = clients.push(connection) - 1;
    var clientId = ++nunmConnections;
    clientConnections[clientId.toString()] = connection;
    var clientColor = false;
    var clientName = false; // Spawn some default name maybe?

    // All is given a mouse joint to play with
    var mouseJoint = false;

    console.log((new Date()) + ' Connection accepted.' + 'Number of connections: ' + Object.size(clientConnections));

    /*
    * Handle infromation sent form client
     */
    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        // try to parse json (assume information from client is json)
        try {
            var jd = JSON.parse(message.utf8Data);
        } catch (e) {
            console.log('Not JSON format! : ', message.utf8Data);
            return;
        }
        if(jd.type === "clientjoin") {
          // Set user name
          clientName = jd.data.name;
          clientColor = colors.shift(); 
         
          // Add the client information to server
          addClient(clientId,clientName,clientColor);

          //Set username in clientInformation
          clientInformation[clientId.toString()].name = clientName;

          // Send accept message
          sendClientJoinAccept(clientId,clientName,clientColor);

          // Send updated player info to all clients
          sendUpdatedPlyersInfo();
        } 
        else if(jd.type === "gravity") {
          // Add point gravity field on all objects in the scene
          addPointGravityForce(jd.data.position,jd.data.force);

        } else if (jd.type === "killrequest") {

          // Remove the object from the scene
          if (DEBUG_LOG)
            console.log(JSON.stringify(jd));

          // Remove the entity
          removeEntityFromScene(jd.data.entityId);

          // Broadcast the kill event to all clients
          broadcastJsonEvent(JSON.stringify(jd));

        } else if (jd.type === "createEntity") {

          if (DEBUG_LOG)
            console.log(JSON.stringify(jd));

          // randomize position
          var pos = new CANNON.Vec3((Math.random()-0.5)*20,10 + (Math.random()-0.5)*1,(Math.random()-0.5)*20);
         
          if (jd.data.entitytype === "box") {
            
            var halfExtents = new CANNON.Vec3(jd.data.halfExtents[0],jd.data.halfExtents[1],jd.data.halfExtents[2]);
            createBox(pos,jd.data.mass,halfExtents);
          } else if (jd.data.entitytype === "sphere") {
            createSphere(pos,jd.data.mass,jd.data.radius);
          }
        } else if (jd.type === "clearScene") {
          if (DEBUG_LOG)
            console.log(JSON.stringify(jd));

          clearScene();
          
          broadcastJsonEvent(JSON.stringify(jd));
          
          createScene();
        
        }else if (jd.type === "mousedown") {
          if (DEBUG_LOG)
            console.log(JSON.stringify(jd));
          
          // Delete previous mouse joint
          if(mouseJoint){
            if (DEBUG_LOG)
              console.log("rem old constriant")
            mouseJoint.removeJointConstraint();
            mouseJoint = false;
          }
          
          // Check if entity exists. Create a mousejoint
          if(cannonEntities[jd.data.entityId])
            mouseJoint = new MouseJoint(new CANNON.Vec3(jd.data.point[0],jd.data.point[1],jd.data.point[2]),
              cannonEntities[jd.data.entityId],cannonWorld);

          // Print number of constriants
          if (DEBUG_LOG)
            console.log("num constriants: " + cannonWorld.constraints.length);

        } else if (jd.type === "mouseup") {
          if (DEBUG_LOG)
            console.log(JSON.stringify(jd));

          // Delete previous mouse joint
          if(mouseJoint){
            if (DEBUG_LOG)
              console.log("rem old constriant");

            mouseJoint.removeJointConstraint();
            mouseJoint = false;
          }
        } else if (jd.type === "mousemove") {
          // Move the mouse joint 
          var pos = new CANNON.Vec3(jd.data.point[0],jd.data.point[1],jd.data.point[2]);

          // Move the mouse joint
          if(mouseJoint) mouseJoint.moveJointToPoint(pos);
        } else if (jd.type === "message"){
          // Check type of message
          if (jd.data.type === "chat") 
            sendChatMessage(jd,clientName,clientColor);
        } else {
          if (DEBUG_LOG)
            console.log("recieved unkown message type: " + jd.type);
        }
      }
    });

    // user disconnected
    connection.on('close', function(connection) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");

            sendPlayerInfoEvent(clientId,clientName,clientColor,true);

            // remove connection
            delete clientConnections[clientId.toString()];
            // remove information 
            delete clientInformation[clientId.toString()];
            // Add color back if user got one
            if (clientColor) 
              colors.push(clientColor);
    });
});

/***********************************************************************
* CANNON utility functions
***********************************************************************/

/** 
* This function clears the cannon scene  
*/
function clearScene() {
  // Clear from simulation
  for(var key in cannonEntities) {
    removeEntityFromScene(key);
  }
  // Clear the body array, just to be safe
  cannonEntities = {};
}

/**
* This function converts a cannon world to JSON format for sending over 
* a network
*/
function entities2Json(entities){
  // Define contents of the json data
  var jsonData = {type:"worlddata",bodies:[]}
  // Get bodies
  var cbodies = cannonWorld.bodies;
  for (var key in entities){
    var cbody = entities[key];
    // Get position and rotation from the body
    var pos = cbody.position;
    var rot = cbody.quaternion;
    // Get shape type
    var ctype = cbody.shape.type;
    switch(ctype) {
      case CANNON.Shape.types.SPHERE:
        jsonData.bodies.push({
          type:ctype,
          id:key,
          radius:cbody.shape.radius,
          position:[pos.x,pos.y,pos.z],
          quaternion:[rot.x,rot.y,rot.z,rot.w] 
        });
        break;
      case CANNON.Shape.types.BOX:
        var he = cbody.shape.halfExtents;
        jsonData.bodies.push({
          type:ctype, 
          id:key,
          halfExtents:[he.x,he.y,he.z],
          position:[pos.x,pos.y,pos.z],
          quaternion:[rot.x,rot.y,rot.z,rot.w] 
        });
        break;
      case CANNON.Shape.types.PLANE:
        jsonData.bodies.push({
          type:ctype, 
          id:key,
          position:[pos.x,pos.y,pos.z],
          quaternion:[rot.x,rot.y,rot.z,rot.w] 
        });
        break;
      case CANNON.Shape.types.COMPOUND:
        // I have no idea what to do here       
        console.log('WARNING: This shape is not supported by the jsonData parsing');
        break;
      case CANNON.Shape.types.CONVEXPOLYHEDRON:
        console.log('WARNING: This shape is not supported by the jsonData parsing');
        break;
      default:
        console.log('WARNING: This shape is not supported by the jsonData parsing');
        break;
    }
  }
  return jsonData;
}

function removeEntityFromScene(entityId) {
  // Remove from the scene
  if(cannonEntities[entityId] && cannonEntities[entityId].world)
    cannonWorld.remove(cannonEntities[entityId]);

  // Remove from the object array
  delete cannonEntities[entityId];
}

function shapeTypeTostring(type) {
  
  var retstring = false;

  switch(type)
  {
  case CANNON.Shape.types.SPHERE:
    retstring = 'CANNON.Shape.types.SPHERE';
    break;
  case CANNON.Shape.types.BOX:
    retstring = 'CANNON.Shape.types.BOX';
    break;
  case CANNON.Shape.types.PLANE:
    retstring = 'CANNON.Shape.types.PLANE';
    break;
  case CANNON.Shape.types.COMPOUND:
    retstring = 'CANNON.Shape.types.COMPOUND';
    break;
  case CANNON.Shape.types.CONVEXPOLYHEDRON:
    retstring = 'CANNON.Shape.types.CONVEXPOLYHEDRO';
    break;
  default:
    retstring = 'WARNING: This shape is not supported';
    break;
  }
  return retstring;
}

function printWorldInfromation(cannonWorld){
  // Get bodies from world
  var bodies = cannonWorld.bodies;

  console.log("*************** World information ***************");

  // Loop all bodies in the world and then print information
  for (var i=0 ; i < cannonWorld.numObjects() ; i++){
    var body = bodies[i];
    var positionStr = body.position.toString();
    var typeString =  shapeTypeTostring(body.shape.type);
    var bodystring = "type: " + typeString + 
            "|| position" + positionStr;
    console.log(bodystring);
  }
}

/**************************
* Cannon init function  
***************************/
function initCannon(){
  // Setup our world
  cannonWorld = new CANNON.World();
  cannonWorld.quatNormalizeSkip = 0;
  cannonWorld.quatNormalizeFast = false;
  cannonWorld.solver.setSpookParams(50000000,10);
  cannonWorld.solver.iterations = 10;
  cannonWorld.gravity.set(0,-20,0);
  cannonWorld.broadphase = new CANNON.NaiveBroadphase();

  // Create a slippery material (friction coefficient = 0.0)
  physicsMaterial = new CANNON.Material("slipperyMaterial");
  var physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial,
                                                          physicsMaterial,
                                                          0.2, // friction coefficient
                                                          0.3  // restitution
                                                          );

  // We must add the contact materials to the world
  cannonWorld.addContactMaterial(physicsContactMaterial);
}

/******************************************************************
* Create scene
******************************************************************/
function createScene() {

  // Create a sphere
  var mass = 5, radius = 1.3;
  sphereShape = new CANNON.Sphere(radius);
  sphereBody = new CANNON.RigidBody(mass,sphereShape,physicsMaterial);
  sphereBody.position.set(0,10,0);
  //sphereBody.linearDamping = 0.01;
  cannonWorld.add(sphereBody);
  cannonEntities[(numBodies++).toString()] = sphereBody;

  // Create a plane
  var groundShape = new CANNON.Plane();
  var groundBody = new CANNON.RigidBody(0,groundShape,physicsMaterial);
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
  cannonWorld.add(groundBody);
  cannonEntities[(numBodies++).toString()] = groundBody;

  // Add boxes
  var halfExtents = new CANNON.Vec3(1,1,1);
  var boxShape = new CANNON.Box(halfExtents);
  for(var i=0; i<3; i++){
      var x = (Math.random()-0.5)*20;
      var y = 1 + (Math.random()-0.5)*1;
      var z = (Math.random()-0.5)*20;
      var boxBody = new CANNON.RigidBody(5,boxShape);
      cannonWorld.add(boxBody);
      boxBody.position.set(x,y,z);
      cannonEntities[(numBodies++).toString()] = boxBody;
  }
}

/******************************************************************
* Define callbacks and diverse stuff
******************************************************************/
function addPointGravityForce(position,force) {

  var pos = new CANNON.Vec3(position[0],position[1],position[2]);

  // loop all boides in the scene
  for (var key in cannonEntities) {
    var dir = pos.vsub(cannonEntities[key].position); 

    // get normal of the direction
    dir = dir.unit();

    // Add force to cannon entity
   cannonEntities[key].force = cannonEntities[key].force.vadd(dir.mult(force));
  }
}

function createBox(pos,mass,he) {
  var boxShape = new CANNON.Box(he);
  var boxBody = new CANNON.RigidBody(mass,boxShape);
  boxBody.position = pos;
  cannonWorld.add(boxBody);
  cannonEntities[(numBodies++).toString()] = boxBody;
}

function createSphere(pos,mass,radius) {
  var sphereShape = new CANNON.Sphere(radius);
  var sphereBody = new CANNON.RigidBody(mass,sphereShape);
  sphereBody.position = pos;
  cannonWorld.add(sphereBody);
  cannonEntities[(numBodies++).toString()] = sphereBody;
}

function sendPlayerInformationToClient(clientId,players){
  for (var key in players) {
    var player = players[key];
    var js = {
      type:"playerinfo", 
      data:{id:player.id,
        name:player.name,
        disc:player.disc,
        color:player.color}
    };    
    var json = JSON.stringify(js);
    clientConnections[clientId.toString()].sendUTF(json);
  }
}

function sendUpdatedPlyersInfo(){
  for (var key in clientInformation) {
    sendPlayerInformationToClient(clientInformation[key].id,clientInformation);
  }  
}

function sendPlayerInfoEvent(id,name,color,disc) {
  // COnstruct information
  var js = {type:"playerinfo", data:{id:id,name:name,color:color,disc:disc}};    
  var json = JSON.stringify(js);
  broadcastJsonEvent(json);
}

function sendClientJoinAccept(clientId,clientName,clientColor){
    // COnstruct information
  var js = {type:"clientJoinAccept", data:{id:clientId,name:clientName,color:clientColor}};    
  var json = JSON.stringify(js);
  if (DEBUG_LOG)
    console.log("sending client join accpet: " + json);
  clientConnections[clientId.toString()].sendUTF(json);
}

function sendChatMessage(jd,clientName,clientColor){
  // Send message to all clients
  var message = { type:"chat", 
    data:{
      time: (new Date()).getTime(),
      text: htmlEntities(jd.data.string),
      author: clientName,
      color: clientColor
    }
  };
  broadcastJsonEvent(JSON.stringify(message));
}

function addClient(clientIndex,clientName,clientColor){
  var client = {
    id : clientIndex,
    name : clientName,
    color : clientColor
  }
  clientInformation[client.id.toString()] = client;
}

function broadcastJsonEvent(jsonData) {
  // Loop over all clients and send the jsonData event
  for (var key in clientConnections) {
    clientConnections[key].sendUTF(jsonData); 
  }
}

/**************************
* Simulation loop callback 
***************************/
setInterval(function(){
    // Step the world if there are clients connected
    if(Object.size(clientConnections) > 0)
      cannonWorld.step(dt);

    // Broadcast world information about all boides to clients
    var json = JSON.stringify(entities2Json(cannonEntities));
    broadcastJsonEvent(json);

}, 1.0/60.0 * 1000);

/************************************************************
* This is a class for creating and handling mouse joint data
* A point-point constriant is created between the mouse and 
* the point klicked on the rigid body
*************************************************************/
function MouseJoint(point, cannonBody, world) {
  // THis is the cannon body constrained by the mouse joint
  this.rigidBody = cannonBody;

  // This is the first constraint point relative to the body
  var v1 = point.vsub(cannonBody.position);

  // Apply anti-transformation to vector to get it in the local coordinate system
  var antiRot = cannonBody.quaternion.inverse();
  this.rBody = antiRot.vmult(v1);

  // Create a body on the mouse joint that has mass 0, that the other body can be constrianed too
  this.jointBody = createJointBody();

  // This is the second constraint point, which is where the mouse is. Set it to jointbod
  this.jointBody.position = point;

  // Create a new distance-constraint in the world
  this.constraint = new CANNON.PointToPointConstraint(this.rigidBody,this.rBody,this.jointBody,new CANNON.Vec3(0,0,0));

  // THe world that the mouse joint belongs too
  this.world = world;

  // Add constriant to world
  world.addConstraint(this.constraint);

  function createJointBody() {
    var shape = new CANNON.Sphere(0.0001);
    return new CANNON.RigidBody(0,shape,new CANNON.Material("particlematerial"));
  }
}

// This functions moves the transparent joint body to a new postion in space
MouseJoint.prototype.moveJointToPoint = function(point) {
    // Move the joint body to a new position
    this.jointBody.position = point;
    this.constraint.update();
  }

MouseJoint.prototype.removeJointConstraint = function() {
  // Remove constriant from world
  this.world.removeConstraint(this.constraint);
}

