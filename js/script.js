import * as THREE from "https://threejs.org/build/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://threejs.org/examples/jsm/controls/TransformControls.js";
import { Line2 } from "https://threejs.org/examples/jsm/lines/Line2.js";
import { LineMaterial } from "https://threejs.org/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "https://threejs.org/examples/jsm/lines/LineGeometry.js";

var renderer, miniAxisRenderer, scene, miniAxisScene, camera, miniAxisCamera;
var controls, transformControls;
var matLine, matLineBasic;
var matLineDrawn;
var materials = [];

var paths = [];

var somethingSelected = false;
var selectedObject; //may not be necessary anymore
var selectedGroup;
var tempgroup;
var tempArray;

//var selection = app.selection;
var transforming;
var raycaster;
var raycastObject;

var selectionBoxStartX, selectionBoxStartY;

var selectionBox;
var helper;

var linesNeedThemeUpdate = false;

var drawingCanvas = document.getElementById("drawingCanvas");
var context = drawingCanvas.getContext("2d");
drawingCanvas.width = window.innerWidth;
drawingCanvas.height = window.innerHeight;
var main = document.getElementById("main");
var miniAxis = document.getElementById("miniAxis");

// viewport
var insetWidth;
var insetHeight;

//selection
var pickedObjects = [];

var themes = {
    blueprint: {
        backgroundColor: '',
        mainColor: '',
    },
    light: {
        backgroundColor: '',
        mainColor: '',
    },
    dark: {
        backgroundColor: '',
        mainColor: '',
    }
}

init();
animate();

let mouse = {
    tx: 0, //x coord for threejs
    ty: 0, //y coord for threejs
    cx: 0, //x coord for canvas
    cy: 0, //y coord for canvas
    updateCoordinates: function (event) {
        if (event.touches) {
            this.tx = (event.changedTouches[0].pageX / window.innerWidth) * 2 - 1;
            this.ty = -(event.changedTouches[0].pageY / window.innerHeight) * 2 + 1;
            this.cx = event.changedTouches[0].pageX;
            this.cy = event.changedTouches[0].pageY;
            //handler if it's a mouse event
        } else {
            this.tx = (event.clientX / window.innerWidth) * 2 - 1;
            this.ty = -(event.clientY / window.innerHeight) * 2 + 1;
            this.cx = event.clientX;
            this.cy = event.clientY;
        }
    }
};

var line = {
    linepositions: [],
    start: function () {
        this.linepositions = []; //reset array
        //draw line
        context.beginPath();
        context.lineWidth = app.lineWidth;
        context.strokeStyle = app.lineColor;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.moveTo(mouse.cx, mouse.cy);
        //Start
        var vNow = new THREE.Vector3(mouse.tx, mouse.ty, 0);
        vNow.unproject(camera);
        this.linepositions.push(vNow.x, vNow.y, vNow.z);
    },
    move: function () {
        //Draw on canvas
        context.lineTo(mouse.cx, mouse.cy);
        context.stroke();
        //Add line elements
        var vNow = new THREE.Vector3(mouse.tx, mouse.ty, 0);
        vNow.unproject(camera);
        this.linepositions.push(vNow.x, vNow.y, vNow.z);
    },
    end: function () {
        //render line
        context.lineTo(mouse.cx, mouse.cy);
        context.stroke();
        context.closePath();
        context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        //Close and add line to scene
        var vNow = new THREE.Vector3(mouse.tx, mouse.ty, 0);
        vNow.unproject(camera);
        this.linepositions.push(vNow.x, vNow.y, vNow.z);
        //linecolors.push(206, 216, 247);
        this.renderLine(this.linepositions);
    },
    renderLine: function (positions) {
        var matLineDrawn = new LineMaterial({
            color: new THREE.Color(app.lineColor),
            linewidth: app.lineWidth, // in pixels
            vertexColors: false,
            wireframe: false,
            depthWrite: true
        });
        materials.push(matLineDrawn); //this is needed to set the resolution in the renderer properly
        var geometry = new LineGeometry();
        this.rejectPalm();
        geometry.setPositions(positions);
        var l = new Line2(geometry, matLineDrawn);
        l.position.set(
            l.geometry.boundingSphere.center.x,
            l.geometry.boundingSphere.center.y,
            l.geometry.boundingSphere.center.z
        );
        l.geometry.center();
        l.needsUpdate = true;
        l.computeLineDistances();
        l.scale.set(1, 1, 1);
        l.layers.set(1);
        scene.add(l);
        //Remove listener and clear arrays
    },
    mirror: function () {
    },
    rejectPalm: function () {
        //rudimentary approach to palm rejection
        //are too far apart and are artifacts of palm rejection failing
        for (var i = 0; i < this.linepositions.length - 2; i = i + 2) {
            if (this.linepositions.length[i] - this.linepositions.length[i + 2] > 0.1) {
                this.linepositions.slice(i)
            }
        }
    }
}

function updateminiAxisCamera() {
    miniAxisCamera.zoom = camera.zoom;
    miniAxisCamera.position.copy(camera.position);
    miniAxisCamera.quaternion.copy(camera.quaternion);
}

function selectedTool() {
    return app.selectedTool;
}

function checkIfHelperObject(object) {
    if (object.type === "AxesHelper" || object.type === "GridHelper" || object.type === "Object3D") {
        return true
    } else { return false }
}

function drawStart() {
    line.start();
}
function drawMove() {
    line.move();
}
function drawEnd() {
    line.end();
}

function eraseStart() {
    raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.01;
    raycaster.layers.set(1);
    paths.push([mouse.cx, mouse.cy]);
}
function eraseMove() {
    paths[paths.length - 1].push([mouse.cx, mouse.cy]);
    //This is to render line transparency,
    //we are redrawing the line every frame
    redrawLine('rgba(255,20,147, 0.15)');

    raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
    var object = raycaster.intersectObjects(scene.children)[0].object;
    if (checkIfHelperObject(object)) {
    } else {
        scene.remove(object);
    }
}
function eraseEnd() {
    //Actually empty for now
    context.closePath();
    context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    paths = [];
}

function selectStart() {
    app.selection.start();
}
function selectMove() {
    app.selection.move();
}
function selectEnd() {
    app.selection.end();
}

function toggleDash(object, bool) {
    var material = object.material;
    material.dashed = bool;

    var ratio = 1000;
    console.log(material.linewidth / ratio)

    // dashed is implemented as a defines -- not as a uniform. this could be changed.
    // ... or THREE.LineDashedMaterial could be implemented as a separate material
    // temporary hack - renderer should do this eventually
    if (bool) material.defines.USE_DASH = "";
    else delete material.defines.USE_DASH;
    material.dashSize = bool ? material.linewidth / ratio : 1000;
    material.gapSize = bool ? material.linewidth / ratio : 1000;
    //material.wireframe = bool;
    material.dashScale = bool ? 1 : 1000;
    material.needsUpdate = true;
}

function init() {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); //transparent so the background shows through
    renderer.setSize(window.innerWidth, window.innerHeight);
    main.appendChild(renderer.domElement);

    miniAxisRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
    });
    miniAxisRenderer.setPixelRatio(window.devicePixelRatio);
    miniAxisRenderer.setClearColor(0x000000, 1);
    miniAxisRenderer.setSize(300, 300);
    miniAxis.appendChild(miniAxisRenderer.domElement);

    scene = new THREE.Scene();
    miniAxisScene = new THREE.Scene();

    var axesHelper = new THREE.AxesHelper();
    axesHelper.layers.set(0);
    scene.add(axesHelper);

    var axesHelperFlipped = new THREE.AxesHelper();
    axesHelperFlipped.applyMatrix4(new THREE.Matrix4().makeScale(-1, -1, -1));
    axesHelperFlipped.layers.set(0);
    scene.add(axesHelperFlipped);

    drawAxisHelperControls();

    var size = 1;
    var divisions = 1;
    var gridHelper = new THREE.GridHelper(size, divisions);
    gridHelper.layers.set(0);
    scene.add(gridHelper);

    camera = new THREE.OrthographicCamera(
        window.innerWidth / -2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        window.innerHeight / -2,
        1,
        3
    );
    camera.layers.enable(0); // enabled by default
    camera.layers.enable(1);

    camera.position.set(0, 0, 2);
    controls = new OrbitControls(camera, miniAxisRenderer.domElement);
    controls.enabled = true;
    controls.minDistance = 1;
    controls.maxDistance = 3;
    controls.rotateSpeed = 0.5;
    controls.autoRotateSpeed = 5.0;
    camera.zoom = 900;
    controls.zoomEnabled = false;
    controls.panEnabled = false;
    transformControls = new TransformControls(camera, drawingCanvas);

    miniAxisCamera = new THREE.OrthographicCamera();
    miniAxisCamera.position.copy(camera.position);
    miniAxisCamera.zoom = 75;
    miniAxisCamera.layers.enable(0);
    miniAxisCamera.layers.enable(1);

    app.selection = {
        array: [],
        current: [],
        selecting: [],
        somethingSelected: false,
        group: undefined,
        start: function () {
            if (!transforming) {
                paths.push([mouse.cx, mouse.cy]);
                raycaster = new THREE.Raycaster();
                raycaster.layers.set(1);
                raycaster.params.Line.threshold = 0.01;
            }
            //Setting the first raycast at start point seems to be causing problems,
            //turning it off for now
            /*raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
            var intersectObject = raycaster.intersectObjects(scene.children)[0].object;
            if (intersectObject && !checkIfHelperObject(intersectObject)) {
                toggleDash(intersectObject, true);
                tempArray.push(intersectObject);
            }*/
        },
        move: function () {
            if (!transforming) {
                paths[paths.length - 1].push([mouse.cx, mouse.cy]);
                //This is to render line transparency,
                //we are redrawing the line every frame
                this.redrawLine('rgba(255, 255, 255, 0.15)');
            }
            //If nothing is already selected we add to the selection 
            if (this.current.length === 0) {
                raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
                var intersectObject = raycaster.intersectObjects(scene.children)[0].object;
                //Check if the object exists, check if it's not an helper object, check if it's already in the tempArray
                if (intersectObject && !checkIfHelperObject(intersectObject) && this.selecting.indexOf(intersectObject) < 0) {
                    toggleDash(intersectObject, true);
                    this.selecting.push(intersectObject);
                }
            }
        },
        end: function () {
            if (!transforming) {
                context.closePath();
                context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
                paths = [];
            }
            //If selecting array is empty and we are not transforming: it means we selected nothing and we deselect
            if (this.selecting.length == 0 && !transforming) {
                this.deselect();
            }
            //If tempArray has one selected object, 
            //we attach the controls only to that object
            //and push that object into the current array
            else if (this.selecting.length == 1) {
                //somethingSelected = true;
                transformControls = new TransformControls(camera, drawingCanvas);
                transformControls.attach(this.selecting[0]);
                this.current.push(this.selecting[0]);
                scene.add(transformControls);
                transformControls.addEventListener("mouseDown", function () {
                    transforming = true;
                });
                transformControls.addEventListener("mouseUp", function () {
                    transforming = false;
                });
                this.selecting = []; //reset
            }
            //If selecting has several selected objects,
            //we group them together and attach transform controls to the group
            //and push them to the group array
            else if (this.selecting.length > 1) {
                this.group = new THREE.Group();
                scene.add(this.group);
                //Add all the selected elements to the temporary groups
                this.selecting.forEach(element => {
                    toggleDash(element, true)
                    this.group.add(element);
                })
                //Attach controls to the temporary group
                transformControls = new TransformControls(camera, drawingCanvas);
                transformControls.attach(this.group);
                scene.add(transformControls);
                //Calculate center between the elements of the group
                function computeGroupCenter() {
                    var center = new THREE.Vector3();
                    var children = app.selection.group.children;
                    var count = children.length;
                    for (var i = 0; i < count; i++) {
                        center.add(children[i].position);
                    }
                    center.divideScalar(count);
                    return center;
                }
                transformControls.position.set(
                    computeGroupCenter().x,
                    computeGroupCenter().y,
                    computeGroupCenter().z
                );
                transformControls.addEventListener("mouseDown", function () {
                    transforming = true;
                });
                transformControls.addEventListener("mouseUp", function () {
                    transforming = false;
                });
                this.selecting = []; //reset
            }
        },
        duplicate: function () {
            //it's a group
            if (this.current.length > 1) {
                var duplicateArray = [];
                this.current.forEach(object => {
                    var duplicate = object.clone();
                    var duplicateMaterial = object.material.clone();
                    duplicate.material = duplicateMaterial;
                    duplicateArray.push(duplicate);
                })
                //deselect current group
                this.deselect();

                this.current = duplicateArray;

                //somethingSelected = true;
                this.group = new THREE.Group();
                scene.add(this.group);
                //Add all the selected elements to the temporary groups
                this.current.forEach(element => {
                    toggleDash(element, true)
                    this.group.add(element);
                })
                //Attach controls to the temporary group
                transformControls = new TransformControls(camera, drawingCanvas);
                transformControls.attach(this.group);
                scene.add(transformControls);
                //Calculate center between the elements of the group
                transformControls.position.set(
                    computeGroupCenter().x,
                    computeGroupCenter().y,
                    computeGroupCenter().z
                );
                transformControls.addEventListener("mouseDown", function () {
                    transforming = true;
                });
                transformControls.addEventListener("mouseUp", function () {
                    transforming = false;
                });
                this.group.position.set(
                    this.group.position.x + 0.1,
                    this.group.position.y,
                    this.group.position.z
                )
            }
            //it's a single objet
            else if (this.current.length == 1) {
                var duplicate = this.current[0].clone();
                var duplicateMaterial = this.current[0].material.clone();
                duplicate.material = duplicateMaterial;
                //deselect current object
                this.deselect();
                //We move the duplicate a tiny bit
                //This needs to be adjusted based on camera position?
                duplicate.position.set(
                    duplicate.position.x + 0.1,
                    duplicate.position.y,
                    duplicate.position.z
                )
                //And select the new one
                this.current.push(duplicate);
                toggleDash(this.current[0], true);
                transformControls = new TransformControls(camera, drawingCanvas);
                transformControls.attach(this.current[0]);
                scene.add(transformControls);
                transformControls.addEventListener("mouseDown", function () {
                    transforming = true;
                });
                transformControls.addEventListener("mouseUp", function () {
                    transforming = false;
                });
                scene.add(duplicate);
            }
        },
        deselect: function () {
            //Ungroup if we have a group selection
            if (typeof this.group !== 'undefined') {
                var ungroupArray = [];
                for (var i = 0; i < this.group.children.length; i++) {
                    var object = this.group.children[i]
                    var position = new THREE.Vector3();
                    position = object.getWorldPosition(position);
                    object.position.copy(position);
                    //Rotation definitly doesn't work. It's difficult to work with because
                    //it requires me to reset the rotation center in the center of the tempgroup
                    //which is a mess so I'll see if I can live without it
                    /*var quaternion = new THREE.Quaternion();
                    quaternion = children.getWorldQuaternion(quaternion);
                    children.quaternion.copy(quaternion);*/
                    object.needsUpdate = true;
                    if (!checkIfHelperObject(object)) {
                        toggleDash(object, false)
                    }
                    ungroupArray.push(object);
                }
                ungroupArray.forEach(object => scene.add(object))
                this.current = [];
                this.group = undefined;
                transformControls.detach();
                transforming = false;
                scene.remove(this.group);
            }
            else if (this.current.length == 1) {
                //console.log(this.array)
                toggleDash(this.current[0], false);
            }
            this.current = [];
            transformControls.detach();
        },
        redrawLine: function (color) {
            // clear canvas
            context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            context.strokeStyle = color;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.lineWidth = 30;
            context.beginPath();
            for (var i = 0; i < paths.length; ++i) {
                var path = paths[i];
                if (path.length < 1)
                    continue;
                context.moveTo(path[0][0], path[0][1]);
                for (var j = 1; j < path.length; ++j)
                    context.lineTo(path[j][0], path[j][1]);
            }
            context.stroke();
        }
    }

    window.addEventListener("resize", onWindowResize, false);
    onWindowResize();
    drawingCanvas.addEventListener("touchstart", onTapStart, false);
    drawingCanvas.addEventListener("mousedown", onTapStart, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    insetWidth = window.innerHeight / 4; // square
    insetHeight = window.innerHeight / 4;
}

function animate() {
    updateminiAxisCamera();
    requestAnimationFrame(animate);

    //may need to wrap this in a function
    if (transformControls) {
        transformControls.mode = app.selectedTransformation;
    }

    //check if we need to disable controls
    if (controls) {
        controls.enabled = !app.controlsLocked
        //should make sure we can't mess with autorotate
        if (app.autoRotate) {
            app.controlsLocked = true;
            camera.layers.disable(0)
            controls.autoRotate = app.autoRotate;
            controls.update();
        } else {
            camera.layers.enable(0)
            app.controlsLocked = false;
        }
    }

    //this sets the resolution of the materials correctly every frame
    //seems to be needed based on examples    
    if (materials) {
        materials.forEach(material =>
            material.resolution.set(window.innerWidth, window.innerHeight)
        );
    }

    //Update colors of lines based on theme?
    if (app.linesNeedThemeUpdate) {
        scene.children.forEach(object => {
            if (object.layers.mask == 2) {
                if (app.selectedTheme == 'blueprint' || app.selectedTheme == 'dark') {
                    if (
                        object.material.color.r == 0 &&
                        object.material.color.g == 0 &&
                        object.material.color.b == 0
                    ) { object.material.color = { r: 1, g: 1, b: 1 }; }
                } else {
                    if (
                        object.material.color.r == 1 &&
                        object.material.color.g == 1 &&
                        object.material.color.b == 1
                    ) { object.material.color = { r: 0, g: 0, b: 0 }; }
                }
            }
        })
        app.linesNeedThemeUpdate = false;
    }

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    miniAxisRenderer.setViewport(0, 0, 300, 300);
    renderer.render(scene, camera);
    miniAxisRenderer.render(miniAxisScene, miniAxisCamera);
}

function onTapMove(event) {
    mouse.updateCoordinates(event);
    //DRAW
    if (selectedTool() == "draw") {
        drawMove();
    }
    //ERASER
    else if (selectedTool() == "erase") {
        eraseMove()
    }
    //SELECT
    else if (selectedTool() == "select") {
        selectMove()
    }
}

function onTapEnd(event) {
    //handler if it's a touch event
    mouse.updateCoordinates(event);
    //DRAW
    if (selectedTool() == "draw") {
        drawEnd()
    }
    //ERASER
    else if (selectedTool() == "erase") {
        eraseEnd()
    }
    //SELECT
    else if (selectedTool() == "select") {
        selectEnd()
    }
    drawingCanvas.removeEventListener("touchmove", onTapMove, false);
    drawingCanvas.removeEventListener("mousemove", onTapMove, false);
}

function onTapStart(event) {
    if (event.which == 3) return;
    mouse.updateCoordinates(event);
    //DRAW
    if (selectedTool() == "draw") {
        drawStart()
    }
    //ERASER
    else if (selectedTool() == "erase") {
        eraseStart();
    }
    //SELECT
    else if (selectedTool() == "select") {
        selectStart();
    }
    drawingCanvas.addEventListener("touchmove", onTapMove, false);
    drawingCanvas.addEventListener("mousemove", onTapMove, false);
    drawingCanvas.addEventListener("touchend", onTapEnd, false);
    drawingCanvas.addEventListener("mouseup", onTapEnd, false);
}

//Undo: it removes the last object added to the scene, unless it's an AxesHelper or a GridHelper
//I might need to make it smarter so it also deletes materials and geometry connected to the deleted object

/*document.getElementById("undo").addEventListener("click", function() {
  var objectToBeRemoved = scene.children[scene.children.length - 1];
  console.log(objectToBeRemoved);
  if (
    objectToBeRemoved.type === "AxesHelper" ||
    objectToBeRemoved.type === "GridHelper"
  ) {
    //do nothing
  } else {
    scene.remove(scene.children[scene.children.length - 1]);
  }
});*/

// function drawTestLines() {
//     var positions = [];
//     var colors = [];
//     // Position and THREE.Color Data
//     positions.push(0.1, 0.1, 0.1);
//     positions.push(0.4, 0.4, 0.4);
//     colors.push(255, 0, 0);
//     colors.push(255, 0, 0);
//     // Line2 ( LineGeometry, LineMaterial )
//     var geometry = new LineGeometry();
//     //geometry.setDrawRange( 0, 100);
//     //geometry.maxInstancedCount = 100;
//     geometry.setPositions(
//         positions,
//         new THREE.Float32BufferAttribute(positions, 3)
//     );
//     geometry.setColors(colors);
//     matLine = new LineMaterial({
//         //color: 0xffffff,
//         linewidth: app.lineWidth, // in pixels
//         vertexColors: true,
//         //resolution:  // to be set by renderer, eventually
//         depthWrite: false
//     });
//     materials.push(matLine);
//     var line = new Line2(geometry, matLine);
//     //Recentering geometry around the central point
//     line.position.set(
//         line.geometry.boundingSphere.center.x,
//         line.geometry.boundingSphere.center.y,
//         line.geometry.boundingSphere.center.z
//     );
//     line.geometry.center();
//     line.needsUpdate = true;
//     line.computeLineDistances();
//     line.scale.set(1, 1, 1);
//     line.layers.set(1);
//     scene.add(line);
//     var positions = [];
//     var colors = [];
//     // Position and THREE.Color Data
//     positions.push(0.4, 0, 0);
//     positions.push(0, 0.4, 0.4);
//     colors.push(255, 0, 0);
//     colors.push(255, 0, 0);
//     // Line2 ( LineGeometry, LineMaterial )
//     var geometry = new LineGeometry();
//     //geometry.setDrawRange( 0, 100);
//     //geometry.maxInstancedCount = 100;
//     geometry.setPositions(
//         positions,
//         new THREE.Float32BufferAttribute(positions, 3)
//     );
//     geometry.setColors(colors);
//     matLine = new LineMaterial({
//         color: 0xffffff,
//         linewidth: app.lineWidth, // in pixels
//         vertexColors: true,
//         //resolution:  // to be set by renderer, eventually
//         depthWrite: false
//     });
//     materials.push(matLine);
//     line = new Line2(geometry, matLine);
//     //Recentering geometry around the central point
//     line.position.set(
//         line.geometry.boundingSphere.center.x,
//         line.geometry.boundingSphere.center.y,
//         line.geometry.boundingSphere.center.z
//     );
//     line.geometry.center();
//     line.needsUpdate = true;
//     line.computeLineDistances();
//     line.scale.set(1, 1, 1);
//     line.layers.set(1);
//     scene.add(line);
// }

function drawAxisHelperControls() {
    let handlesSize = 0.15;
    let handlesDistance = 0.6

    var controlAxesHelper = new THREE.AxesHelper();
    miniAxisScene.add(controlAxesHelper);
    miniAxisScene.layers.set(0);
    controlAxesHelper.scale.set(0.5, 0.5, 0.5)

    //Z axis
    var geometry = new THREE.SphereGeometry(handlesSize, handlesSize, handlesSize);
    var material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    var sphereZ = new THREE.Mesh(geometry, material);
    sphereZ.position.set(0, 0, handlesDistance)
    sphereZ.name = "z";
    sphereZ.layers.set(1);
    miniAxisScene.add(sphereZ);
    //Y axis
    var geometry = new THREE.SphereGeometry(handlesSize, handlesSize, handlesSize);
    var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    var sphereY = new THREE.Mesh(geometry, material);
    sphereY.position.set(0, handlesDistance, 0)
    sphereY.name = "y";
    sphereY.layers.set(1);
    miniAxisScene.add(sphereY);
    //X axis
    var geometry = new THREE.SphereGeometry(handlesSize, handlesSize, handlesSize);
    var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var sphereX = new THREE.Mesh(geometry, material);
    sphereX.position.set(handlesDistance, 0, 0)
    sphereX.name = "x";
    sphereX.layers.set(1);
    miniAxisScene.add(sphereX);

    //Flipped control handles
    var controlAxesHelperFlipped = new THREE.AxesHelper();
    miniAxisScene.add(controlAxesHelperFlipped);
    controlAxesHelperFlipped.applyMatrix4(new THREE.Matrix4().makeScale(-0.5, -0.5, -0.5));
    miniAxisScene.layers.set(0);

    //-Z axis
    var geometry = new THREE.SphereGeometry(handlesSize, handlesSize, handlesSize);
    var material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    var sphereZFlipped = new THREE.Mesh(geometry, material);
    sphereZFlipped.position.set(0, 0, -handlesDistance)
    sphereZFlipped.name = "-z";
    miniAxisScene.add(sphereZFlipped);
    sphereZFlipped.layers.set(1);
    //-Y axis
    var geometry = new THREE.SphereGeometry(handlesSize, handlesSize, handlesSize);
    var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    var sphereYFlipped = new THREE.Mesh(geometry, material);
    sphereYFlipped.position.set(0, -handlesDistance, 0)
    sphereYFlipped.name = "-y";
    miniAxisScene.add(sphereYFlipped);
    sphereYFlipped.layers.set(1);
    //-X axis
    var geometry = new THREE.SphereGeometry(handlesSize, handlesSize, handlesSize);
    var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var sphereXFlipped = new THREE.Mesh(geometry, material);
    sphereXFlipped.position.set(-handlesDistance, 0, 0)
    sphereXFlipped.name = "-x";
    miniAxisScene.add(sphereXFlipped);
    sphereXFlipped.layers.set(1);

    miniAxis.addEventListener("touchstart", repositionCamera, false);
    miniAxis.addEventListener("mousedown", repositionCamera, false);
}

let miniAxisMouse = {
    tx: 0, //x coord for threejs
    ty: 0, //y coord for threejs
    updateCoordinates: function (event) {
        let canvasBounds = miniAxisRenderer.context.canvas.getBoundingClientRect();
        if (event.touches) {
            this.tx = ((event.changedTouches[0].pageX - canvasBounds.left) / (canvasBounds.right - canvasBounds.left)) * 2 - 1;
            this.ty = - ((event.changedTouches[0].pageY - canvasBounds.top) / (canvasBounds.bottom - canvasBounds.top)) * 2 + 1;
            //handler if it's a mouse event
        } else {
            this.tx = ((event.clientX - canvasBounds.left) / (canvasBounds.right - canvasBounds.left)) * 2 - 1;
            this.ty = -((event.clientY - canvasBounds.top) / (canvasBounds.bottom - canvasBounds.top)) * 2 + 1;
        }
    }
}

function repositionCamera() {
    if (!app.controlsLocked) {
        miniAxisMouse.updateCoordinates(event);
        var miniAxisRaycaster = new THREE.Raycaster();
        miniAxisRaycaster.layers.set(1);
        miniAxisRaycaster.setFromCamera(
            new THREE.Vector2(
                miniAxisMouse.tx,
                miniAxisMouse.ty
            ),
            miniAxisCamera);
        var object = miniAxisRaycaster.intersectObjects(miniAxisScene.children)[0].object;
        if (checkIfHelperObject(object)) {
        } else {
            switch (object.name) {
                case 'z':
                    controls.enabled = false;
                    camera.position.set(0, 0, 2);
                    camera.lookAt(controls.target);
                    controls.enabled = true;
                    break;
                case 'x':
                    controls.enabled = false;
                    camera.position.set(2, 0, 0);
                    camera.lookAt(controls.target);
                    controls.enabled = true;
                    break;
                case 'y':
                    controls.enabled = false;
                    camera.position.set(0, 2, 0);
                    camera.lookAt(controls.target);
                    controls.enabled = true;
                    break;
                case '-x':
                    controls.enabled = false;
                    camera.position.set(-2, 0, 0);
                    camera.lookAt(controls.target);
                    controls.enabled = true;
                    break;
                case '-y':
                    controls.enabled = false;
                    camera.position.set(0, -2, 0);
                    camera.lookAt(controls.target);
                    controls.enabled = true;
                    break;
                case '-z':
                    controls.enabled = false;
                    camera.position.set(0, 0, -2);
                    camera.lookAt(controls.target);
                    controls.enabled = true;
                    break;
                default:
            }
        }
    }
};

var mirroredLinePositions = [];

function mirrorAxis(xBool, yBool, zBool, x, y, z) {
    if (xBool) {
        mirroredLinePositions.push(-x, y, z);
    }
    if (yBool) {
        //fill in later
    }
    if (zBool) {
        //fill in later
    }
}

function drawMirrored(xBool) {
    if (xBool) {
        var matLineDrawn = new LineMaterial({
            color: 0xffffff,
            linewidth: app.lineWidth, // in pixels
            vertexColors: true,
            //resolution set later,
            depthWrite: true
        });
        materials.push(matLineDrawn);
        var geometry = new LineGeometry();
        geometry.setPositions(mirroredLinePositions);
        geometry.setColors(linecolors);
        var line = new Line2(geometry, matLineDrawn);
        //recentering geometry around a central point
        line.position.set(
            line.geometry.boundingSphere.center.x,
            line.geometry.boundingSphere.center.y,
            line.geometry.boundingSphere.center.z
        );
        line.geometry.center();
        line.needsUpdate = true;
        line.computeLineDistances();
        line.scale.set(1, 1, 1);
        line.layers.set(1);
        scene.add(line);

        mirroredLinePositions = [];
    }
}

function recolorLine(object, r, g, b) {
    var colorArray = [];
    for (var x = 0; x < object.geometry.attributes.instanceColorStart.data.array.length; x++) {
        colorArray.push(r)
        colorArray.push(g)
        colorArray.push(b)
    }
    var updatedColors = new Float32Array(colorArray);
    object.geometry.attributes.instanceColorStart.data.array = updatedColors;
    var updatedColors = new Float32Array(colorArray);
    object.geometry.attributes.instanceColorStart.data.array = updatedColors;
    object.geometry.colorsNeedUpdate = true;
    object.material.needsUpdate = true;
}

function getCurvePoints(pts, tension, isClosed, numOfSegments) {

    // use input value if provided, or use a default value   
    tension = (typeof tension != 'undefined') ? tension : 0.5;
    isClosed = isClosed ? isClosed : false;
    numOfSegments = numOfSegments ? numOfSegments : 16;

    var _pts = [], res = [],    // clone array
        x, y,           // our x,y coords
        t1x, t2x, t1y, t2y, // tension vectors
        c1, c2, c3, c4,     // cardinal points
        st, t, i;       // steps based on num. of segments

    // clone array so we don't change the original
    //
    _pts = pts.slice(0);

    // The algorithm require a previous and next point to the actual point array.
    // Check if we will draw closed or open curve.
    // If closed, copy end points to beginning and first points to end
    // If open, duplicate first points to befinning, end points to end
    if (isClosed) {
        _pts.unshift(pts[pts.length - 1]);
        _pts.unshift(pts[pts.length - 2]);
        _pts.unshift(pts[pts.length - 1]);
        _pts.unshift(pts[pts.length - 2]);
        _pts.push(pts[0]);
        _pts.push(pts[1]);
    }
    else {
        _pts.unshift(pts[1]);   //copy 1. point and insert at beginning
        _pts.unshift(pts[0]);
        _pts.push(pts[pts.length - 2]); //copy last point and append
        _pts.push(pts[pts.length - 1]);
    }

    // ok, lets start..

    // 1. loop goes through point array
    // 2. loop goes through each segment between the 2 pts + 1e point before and after
    for (i = 2; i < (_pts.length - 4); i += 2) {
        for (t = 0; t <= numOfSegments; t++) {

            // calc tension vectors
            t1x = (_pts[i + 2] - _pts[i - 2]) * tension;
            t2x = (_pts[i + 4] - _pts[i]) * tension;

            t1y = (_pts[i + 3] - _pts[i - 1]) * tension;
            t2y = (_pts[i + 5] - _pts[i + 1]) * tension;

            // calc step
            st = t / numOfSegments;

            // calc cardinals
            c1 = 2 * Math.pow(st, 3) - 3 * Math.pow(st, 2) + 1;
            c2 = -(2 * Math.pow(st, 3)) + 3 * Math.pow(st, 2);
            c3 = Math.pow(st, 3) - 2 * Math.pow(st, 2) + st;
            c4 = Math.pow(st, 3) - Math.pow(st, 2);

            // calc x and y cords with common control vectors
            x = c1 * _pts[i] + c2 * _pts[i + 2] + c3 * t1x + c4 * t2x;
            y = c1 * _pts[i + 1] + c2 * _pts[i + 3] + c3 * t1y + c4 * t2y;

            //store points in array
            res.push(x);
            res.push(y);

        }
    }

    return res;
}