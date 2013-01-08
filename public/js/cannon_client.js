/*
* This is the client script for cannon multiplayer demo
* It has the following purpose:
* 
* - Recieve world data each time step and render using three.js
* - Send user input to server 
*
*/

$(document).ready(function () {

// Get document indetifiers
var info = $('#info');
var help = $('#help');
var playerContrainer = $('#playertab');
var playersTab = $('#connectedPlayers');
var gconsole = new GConsole('content',10,20);
var input = $('#input');
var nameboxtext = $('#nameboxtext');
var nameboxinput = $('#nameboxinput');
var login = $('#login');

// Hide all elements in the site until player has connected
help.hide();
playerContrainer.hide();
$("#console").hide();

/***********************************************************************
* Handle Websockets connection
***********************************************************************/

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

// Construct server adress
var serverAdress = "ws://" + window.location.hostname + ":80";

var serverConnection = new WebSocket(serverAdress);

console.log($().jquery);

/************************************************************************
* Define global variables 
/***********************************************************************/
// Server connection variables
var joinedServer = false;
var clientColor = false;
var clientId = false;
var clientName = false;

// Init three variables
var DEBUG = false;
var threeScene = false;
var gCamera = false;
var controls = false, useControls=true; 
var container = false;
var renderer = false;
var  projector = false;
var material = false;
var buildOnce = true, buildtOnce=false;
var clock = false;
var time;

// Values for mouse movement
var gplane = false;
var cameraInterpolator = false;

// Cheat sheet for buttons
var BUTTONS = { A: 65, B: 66, C: 67, D: 68, S: 83, R:82, U:85, ESC:27,ENTER:13};

// This holds the clickmarker mesh
var clickMarker = false;
var markerMaterial = false;

// Holds an array for each body to render
var renderEntities = {};
var materialVector = [];

// Holds information about every connected player
var activePlayers = {};  

/*********************************************************************
* THIS IS WERE THE MAIN LOOP STARTS
*********************************************************************/

container = document.getElementById( 'container' );
document.body.appendChild( container );
generateMaterials(materialVector);
initThree();
animate();

/*********************************************************************
* Add connections functions for the websocket
*********************************************************************/
    serverConnection.onopen = function () {
      // connection is opened and ready to use
      nameboxinput.removeAttr('disabled');
      nameboxtext.text('Enter name');
    };

    serverConnection.onerror = function (error) {
        // an error occurred when sending/receiving data
        info.html($('<p>', { text: 'Error in connection or the server is down.' + error.reason + '</p>' } ));
    };

    serverConnection.onmessage = function (message) {

      // try to parse json (assume information from server is json)
      try {
          var jsonData = JSON.parse(message.data);
      } catch (e) {
          console.log('Not JSON format! Aw shitsnaps =(', message.data);
          return;
      }
      if (jsonData.type === 'playerinfo') { 
        // Push the information to the connection 
        handlePlayerInfo(jsonData);
        // handle incoming message
      } else if(jsonData.type === 'clientJoinAccept') {
        
        // Joined server sucessfully
        joinedServer = true;

        initBasicCamera();

        clientColor = jsonData.data.color;
        clientName = jsonData.data.name;
        clientId = jsonData.data.id;

        // TODO: Set marker material to color

        help.show();
        playerContrainer.show();
        $("#console").show();

        // Make so that user can send messages
        input.removeAttr('disabled');
      /*
      * This case handles world information sent to the client
      */
      }else if (jsonData.type === 'worlddata') { 
       
        // Get information about every object
        var bodies = jsonData.bodies;       

        // synch entities from sent json information
        synchEntities(jsonData,renderEntities);

      } else if (jsonData.type === 'killrequest') {
        // Handle kill request
        removeRenderEntity(jsonData.data.entityId);
      } else if (jsonData.type === 'clearScene') {
        removeAllEntities();        
      } else if (jsonData.type === 'chat') { // This is a single text message
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
     * If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong.
     */
    setInterval(function() {
        if (serverConnection.readyState !== 1) {
            info.text('Error: Unable to comminucate with server');
            gconsole.println('Error: Unable to comminucate with server');
        }
    }, 3000);

function handlePlayerInfo(jsonData){
  if(jsonData.data.disc) {
    removePlayerFromId(jsonData.data.id);
  } else {
    addPlayerFromJson(jsonData);
  }
  // Update tab
  updatePlayerTab();
}

function removePlayerFromId(playerId){
  delete activePlayers[playerId.toString()];
}

function addPlayerFromJson(jsonData) {
  var player = {
    id : jsonData.data.id,
    name : jsonData.data.name,
    color : jsonData.data.color
  }
  activePlayers[player.id.toString()] = player;
}

function updatePlayerTab(){
  playersTab.text('');

  for (var key in activePlayers) {
    addPlayerToTab(activePlayers[key].name,activePlayers[key].color);
  };
}

function addPlayerToTab(name,color) {
  playersTab.append('<p><span style="color:' + color + '">' 
        + name + '</span></p>');
}

/**
 * Add message to the chat window
 */
function addMessage(author, message, color, date) {
    var datestr = '[' + (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':'
         + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ']';
    gconsole.println(datestr + '  ' + '[' + author + ']: ' + message,color);    
}

/********************************************************************
* Synchronize function for json to render entities
** *******************************************************************/
function synchEntities(jsonData,clientEntities) {

  // Get bodies form jsonData
  var jbodies = jsonData.bodies;
  // Loop over boides in jsonData
  for (var i=0 ; i < jbodies.length ; i++) {
    var jbody = jbodies[i];

    // Check if entity exists in the client
    if(clientEntities[jbody.id] != null) {
      // Synch position and rotation
      clientEntities[jbody.id].position.set(jbody.position[0],
        jbody.position[1],
        jbody.position[2]);
      clientEntities[jbody.id].quaternion.set(jbody.quaternion[0],
        jbody.quaternion[1],
        jbody.quaternion[2],
        jbody.quaternion[3]);
    } else {
      // Else create a new render primitive form the body
      renderEntities[jbody.id] = createRenderEntity(jbody);
      // Insert it into the scene
      threeScene.add(renderEntities[jbody.id]);
    }
  }
}

/*********************************************************************
* Init functions for THREE 
*********************************************************************/
function initBasicCamera(){
  gCamera.position = new THREE.Vector3(0,10,20);
  gCamera.lookAt(new THREE.Vector3(0,-1,0))
  gCamera.useQuaternion = true;
}

function initInterpolationCamera() {
  cameraInterpolator = new CameraInterpolation(gCamera,[0,-1,0],30,40,10);
  gCamera.lookAt(new THREE.Vector3(0,-1,0));
}

function initThree(){
  gCamera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1000 );

  initInterpolationCamera();

  // CONTROLS
  if (useControls){
    controls = new THREE.TrackballControls( gCamera, container );
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    controls.noZoom = false;
    controls.noPan = false;

    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;

    controls.keys = [ 65, 83, 68 ];
  }

  threeScene = new THREE.Scene();
  threeScene.fog = new THREE.Fog( 0x000000, 0, 500 );
  clock = new THREE.Clock();

  // LIGHTS

  var ambient = new THREE.AmbientLight( 0x111111 );
  threeScene.add( ambient );

  light = new THREE.SpotLight( 0xffffff );
  light.position.set( 10, 30, 20 );
  light.target.position.set( 0, 0, 0 );

  if(true){
      light.castShadow = true;

      light.shadowCameraNear = 20;
      light.shadowCameraFar = 50;//camera.far;
      light.shadowCameraFov = 40;

      light.shadowMapBias = 0.1;
      light.shadowMapDarkness = 0.7;
      light.shadowMapWidth = 2*512;
      light.shadowMapHeight = 2*512;

  }

  threeScene.add( light );

  // PROJECTOR
  projector = new THREE.Projector();

  // MATERIAL
  markerMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } ); 
  material = new THREE.MeshLambertMaterial( { color: 0xdddddd } );

  // RENDERER

  renderer = new THREE.WebGLRenderer();
  renderer.shadowMapEnabled = true;
  renderer.shadowMapSoft = true;
  renderer.setSize( window.innerWidth, window.innerHeight);
  renderer.setClearColor( threeScene.fog.color, 1 );
  container.appendChild( renderer.domElement );
  window.addEventListener( 'resize', onWindowResize, false );

}

function setClickMarker(x,y,z) {
  var mesh;
  if(!clickMarker){
    var shape = new THREE.SphereGeometry( 0.2, 8, 8);
    mesh = new THREE.Mesh(shape, markerMaterial);
    clickMarker = mesh;
  } else 
    mesh = clickMarker;
  mesh.position.set(x,y,z);
  threeScene.add(mesh);
}

function removeClickMarker() {
  threeScene.remove(clickMarker);
}

/*
* This function builds a render scene the render scene with jsonData
* This removes all objects in the previous scene and replaces it 
* with new objects
*/
function rebuildRenderScene(jsonData, renderEntities, scene){

  // Clear previous body data
  removeAllEntities();

  // Insert objects in the three scene
  synchEntities(jsonData,renderEntities);

  // Push all created renderbodies into the scene
  for (var key in renderEntities){
    scene.add(renderEntities[key]);
  }
}

/********************************************************************
* Funciton for creating and inserting an object in the client
* given form jsondata from the server
*********************************************************************/
function createRenderEntity(jbody) {

  // Create render objects from the json data
  var renderMesh = false;
  switch(jbody.type)
  {
  case CANNON.Shape.types.SPHERE:
    renderMesh = createSphere(jbody);
    break;
  case CANNON.Shape.types.BOX:
    renderMesh = createBox(jbody);
    break;
  case CANNON.Shape.types.PLANE:
    renderMesh = createPlane(jbody);
    break;
  case CANNON.Shape.types.COMPOUND:
    console.log('CANNON.Shape.types.COMPOUND not supported');
    break;
  case CANNON.Shape.types.CONVEXPOLYHEDRON:
    console.log('CANNON.Shape.types.CONVEXPOLYHEDRO');
    break;
  default:
    console.log('WARNING: This shape is not supported');
    break;
  }
  setMeshSettings(renderMesh,jbody);
  return renderMesh
}

/********************************************************************
* This section defines events that are sent to the server
*********************************************************************/

function sendGravityEvent() {
  // Send event data in json format
  var clientdata = {position:[0,10,0], force:1000};

  var jd = {type:"gravity", data:clientdata}; 

  // Make data to JSON string format and send it to server
  serverConnection.send(JSON.stringify(jd));
}

// TODO, add render effect
function sendMouseJointEvent(bodyId,point) {
  var data = {entityId:bodyId, point:[point.x,point.y,point.z]};
  var jd = {type:"mousedown", data:data}; 
  serverConnection.send(JSON.stringify(jd));
}

function sendRemoveMouseJointEvent(){
 var data = {}; 
 var jd = {type:"mouseup", data:data};
 serverConnection.send(JSON.stringify(jd));
}

function sendMoveMouseJointEvent(point){
 var data = {point:[point.x,point.y,point.z]}; 
 var jd = {type:"mousemove", data:data};
 serverConnection.send(JSON.stringify(jd));
}

function sendKillRequest(objectId){
  // Send killcommand to server with id 
  var jd = {type:"killrequest", data:{entityId:objectId}};     
  // Stringify information
  serverConnection.send(JSON.stringify(jd));
}

function sendCreateBoxEvent() {
  var data = {entitytype:"box", halfExtents:[1,1,1], mass:5};
  var jd = {type:"createEntity", data:data};
  serverConnection.send(JSON.stringify(jd));
}

function sendCreateSphereEvent() {
    var data = {entitytype:"sphere", halfExtents:[1,1,1], mass:5};
  var jd = {type:"createEntity", data:data};
  serverConnection.send(JSON.stringify(jd));
}

function sendCreateSpherevent() {
  var data = {entitytype:"sphere", radius:1.3, mass:5};
  var jd = {type:"createEntity", data:data};
  serverConnection.send(JSON.stringify(jd));
}

function sendClearSceneEvent() {
  var data = {};
  var jd = {type:"clearScene", data:data};
  serverConnection.send(JSON.stringify(jd));
}

/********************************************************************
* Creation functions for renderable primitives
*********************************************************************/
function createSphere(body) {
  var geom = new THREE.SphereGeometry(body.radius,10,10);
  var mesh = new THREE.Mesh(geom,materialVector[Math.floor(Math.random()*materialVector.length)]);
  return mesh;
}

function createBox(body) {
  var halfExtents = body.halfExtents;
  var geom = new THREE.CubeGeometry(halfExtents[0]*2,halfExtents[1]*2,halfExtents[2]*2);
  var mesh = new THREE.Mesh(geom,materialVector[Math.floor(Math.random()*materialVector.length)]);
  return mesh;
}

function createPlane(body) {
  var geom = new THREE.PlaneGeometry( 300, 300, 50, 50 );
  var mesh = new THREE.Mesh(geom,materialVector[Math.floor(Math.random()*materialVector.length)]);
  return mesh;
}

function removeAllEntities() {
  for (key in renderEntities) {
    removeRenderEntity(key);
  }
}

function removeRenderEntity(entityId) {
  // Remove from scene
  threeScene.remove(renderEntities[entityId]);
  // Remove from entity array
  delete renderEntities[entityId];
}

function setMeshSettings (mesh,body) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.useQuaternion = true;

  // Do position and rotation
  mesh.position.set(body.position[0],body.position[1],body.position[2]);

  mesh.quaternion.set(body.quaternion[0],body.quaternion[1],
                        body.quaternion[2],body.quaternion[3]);
}

function generateMaterials(targetMatVec) {
  for (var i=0 ; i < 10 ; i++) {
    // Generate a color
    targetMatVec.push(new THREE.MeshLambertMaterial({color: Math.random()*0xffffff}));
  }
}

function getMeshTypeString(entity) {
  var geom = entity.geometry;
  if(geom instanceof THREE.SphereGeometry) {
    return 'THREE.Sphere';
  } else if (geom instanceof THREE.PlaneGeometry) {
    return 'THREE.Plane';
  } else if (geom instanceof THREE.CubeGeometry) {
    return 'THREE.Box';
  } else {
    return 'Undefined object';
  }
}

function meshEntityToString(entity) {
  var string = 'ID: ' + entity.id + ' | TYPE: ' + getMeshTypeString(entity);
  return string;
}

// Function that returns a raycaster to use to find intersecting objects 
// in a scene given screen pos and a camera, and a projector
function getRayCasterFromScreenCoord (screenX, screenY, camera, projector) {
  var mouse3D = new THREE.Vector3();
  // Get 3D point form the client x y
  mouse3D.x = (screenX / window.innerWidth) * 2 - 1;
  mouse3D.y = -(screenY / window.innerHeight) * 2 + 1;
  mouse3D.z = 0.5;
  
  return projector.pickingRay(mouse3D, camera);
}

function findNearestIntersectingObject(clientX,clientY,camera,objects) {

  // Get the picking ray from the point
  var raycaster = getRayCasterFromScreenCoord(clientX, clientY, camera, projector);

  // Covert renderentities to an array of objects
  var tempArray = [];
  for (it in objects) {
    tempArray.push(objects[it]);
  }

  // Find the closest intersecting object
  // Now, cast the ray all render objects in the scene to see if they collide. Take the closest one.
  var hits = raycaster.intersectObjects(tempArray);
  closest=false;
  if (hits.length > 0) {
    closest = hits[0];
    closest.direction = raycaster.ray.direction;

    // Find the index of the body
    closest.objectId = false;
    for (key in objects) {
      if (objects[key] === closest.object) {
        closest.objectId = key;
      }
    }
  }       
  return closest;
}

// This function creates a virtual movement plane for the mouseJoint to move in 
function setScreenPerpCenter(point, camera) {
    // If it does not exist, create a new one
    if(!gplane) {
      var planeGeo = new THREE.PlaneGeometry(100,100);
      var plane = gplane = new THREE.Mesh(planeGeo,material);
      plane.visible = false; // Hide it..
      plane.useQuaternion = true;
      threeScene.add(gplane);
    }

    // Center at mouse position
    gplane.position.copy(point);
    
    // Make it face toward the camera
    gplane.quaternion = camera.quaternion;
}

// global variables to ease the updating of the mouse movement
var lastx,lasty,last;

function projectOntoPlane(screenX,screenY,thePlane,camera) {
  var x = screenX;
  var y = screenY;
  var now = new Date().getTime();
  // Take it easy with updating...
  //if(constraintDown && (now-last)>this.dt*1000 && !(lastx==x && lasty==y)){

    // project mouse to that plane
    var hit = findNearestIntersectingObject(screenX,screenY,camera,[thePlane]);
    lastx = x;
    lasty = y;
    last = now;
    if(hit)
        return hit.point;
    //}
    return false;
}

/*********************************************************************
* Add Eventlisteners to the document.  
*********************************************************************/
function onWindowResize() {
    gCamera.aspect = window.innerWidth / window.innerHeight;
    gCamera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );

    if (useControls)
      controls.handleResize();
}

function animate() {
  requestAnimationFrame( animate );

  // Update delta
  var delta = clock.getDelta();

  if (useControls) {
    controls.update();
  }

  // Interpolate camera if user has not joined
  if (!joinedServer) {
    cameraInterpolator.step(delta);
  } 

  render();
}

function render() {
    renderer.render( threeScene, gCamera );
} 

var STATE = { NONE: -1, CONSTRAINT: 0, KILL: 1, ADD: 2 };

var constraintDown = false;

function clientMouseDown(e) {

  if(!joinedServer) return;

  // Check if ctrl is pushed
  if(e.ctrlKey)
    controls.enabled = false;
  else {
    controls.enabled = true;
    return;
  }

  // Get state from the button
  var state = e.button;

  if (state === STATE.KILL) { // Send kill event if left cklick
    
    // Find mesh from a ray
    var entity = findNearestIntersectingObject(e.clientX,e.clientY,gCamera,renderEntities); 

    if (entity.objectId && !(renderEntities[entity.objectId].geometry instanceof THREE.PlaneGeometry)){
      // send kill request
      sendKillRequest(entity.objectId);

      // Remove from renderObjects
      removeRenderEntity(entity[0]);
    }

  } else if (state === STATE.CONSTRAINT) { // Send kill target event  

    constraintDown = true;
    // Find mesh from a ray
    var entity = findNearestIntersectingObject(e.clientX,e.clientY,gCamera,renderEntities); 
    var pos = entity.point;
    if (pos){
      // Set marker on contact point
      setClickMarker(pos.x,pos.y,pos.z,threeScene);

      // Set the movement plane
      setScreenPerpCenter(pos,gCamera);

      // Send mouse Joint Event to server
      sendMouseJointEvent(entity.objectId,pos); 
    }

  } 
}

function clientMouseUp(e) {

  if(!joinedServer) return;

  var state = e.button;

  if (state === STATE.CONSTRAINT) { 
      constraintDown = false;
      // remove the marker 
      removeClickMarker();

      // Send the remove mouse joint to server
      sendRemoveMouseJointEvent(); 
  }
}

function clientMouseMove(e) {

  if(!joinedServer) return;

  var state = e.button;

  if (state === STATE.CONSTRAINT) {  
    
    // Move and project on the plane
    if (gplane && constraintDown) {
      var pos = projectOntoPlane(e.clientX,e.clientY,gplane,gCamera);
      setClickMarker(pos.x,pos.y,pos.z,threeScene);

      // Need to find the plane of movement 
      if (pos) 
        sendMoveMouseJointEvent(pos);
    }

  }
}

function clientKeyDown(e) {

  if(!joinedServer) return;

  // If input has focus, return
  if(input.is(":focus"))
    return;

    // If user presses key enter, a force field request is sent to the server
    if (e.keyCode === BUTTONS.D) {
      sendGravityEvent();
    } 
}

function clientKeyUp(e) {

  if(!joinedServer) return;

  // If input has focus, return
  if(input.is(":focus"))
    return;

    // Check if shift is pushed
  if(e.ctrlKey)
    controls.enabled = false;
  else {
    controls.enabled = true;
  }

  // Create a box when ctr + A is pushed
  if (e.keyCode === BUTTONS.A) {
    // Send message to server to create a box
    sendCreateBoxEvent();
  } 

  if (e.keyCode === BUTTONS.S) {
    // Send message to server to create a box
    sendCreateSphereEvent();
  } 

  if(e.keyCode == BUTTONS.U) {
    // Send message to clear scene
    sendClearSceneEvent();
  }
}

/**
 * Send mesage when user presses Enter key
 */
input.keydown(function(e) {

    // Escape the chat if esc is pressed
    if (e.keyCode === BUTTONS.ESC) {
      $(this).val('');
      $(this).blur();
      return;
    }

    if (e.keyCode === BUTTONS.ENTER) {
        var msg = $(this).val();
        if (!msg) {
            return;
        }

        // Fomrat json information
        var js = {type:"message", 
          data:{
            type:"chat",
            string : msg
         }};

        // send text message
        serverConnection.send(JSON.stringify(js));
        $(this).val('');

        // Blur the input after message is sent
        $(this).blur();        
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

            // Formulate join message to server
            var js = {type:"clientjoin", 
              data:{
              name: msg
            }};

            // send text message
            serverConnection.send(JSON.stringify(js));

            $(this).val('');

            // disable the input field to make the user wait until server
            // Hold yer horses
            nameboxinput.attr('disabled', 'disabled');

            // Remove the namebox div, not needed anymore
            login.detach();
        }
    });

document.addEventListener( 'keydown', clientKeyDown, false );
document.addEventListener( 'keyup', clientKeyUp, false );
document.addEventListener( 'mousedown', clientMouseDown, false );
//$('#document').mousedown(clientMouseDown);
document.addEventListener( 'mouseup', clientMouseUp, false );
document.addEventListener( 'mousemove', clientMouseMove, false );

// Creates a rotation interpolation around the z-axis.
function CameraInterpolation(camera, center, height,  radius, speed) {

  this.camera = camera;

  this.axis = new THREE.Vector3(0,1,0);

  this.center = new THREE.Vector3(center[0],center[1],center[2]);

  this.speed = speed;

  this.radiusVec = new THREE.Vector3(radius,0,0);

  this.rotVector = new THREE.Vector3();

  this.quaternion = new THREE.Quaternion();

  var time = 0;

  // Set quaternion form axis and angle 
  this.quaternion.setFromAxisAngle(this.axis,0);
  
  // Interpolates the camera position
  this.step = function (dt) {
    time = time + dt;

    // Set axis of the quaternion from time
    this.quaternion.setFromAxisAngle(this.axis,time / speed);

    // Normalize
    this.quaternion.normalize();

    // Rotate the vector using the quaternion
    this.quaternion.multiplyVector3(this.radiusVec,this.rotVector);

    // Set postion according to rotated vector
    this.camera.position = new THREE.Vector3().add(this.center,this.rotVector);
    this.camera.position.setY(height);
  }
}
});