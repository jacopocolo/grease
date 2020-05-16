import * as THREE from "https://threejs.org/build/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://threejs.org/examples/jsm/controls/TransformControls.js";
import { Line2 } from "https://threejs.org/examples/jsm/lines/Line2.js";
import { LineMaterial } from "https://threejs.org/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "https://threejs.org/examples/jsm/lines/LineGeometry.js";
import { SelectionBox } from "https://threejs.org/examples/jsm/interactive/SelectionBox.js";
import { SelectionHelper } from "https://threejs.org/examples/jsm/interactive/SelectionHelper.js";

var line, renderer, minirenderer, scene, camera, minicamera;
var controls, transformControls;
var drawingplane;
var matLine, matLineBasic;
var matLineDrawn;
var materials = [];
var somethingSelected = false;
var selectedObject; //may not be necessary anymore
var selectedGroup;
var tempgroup;
var transforming;
var raycaster;
var raycastObject;

var selectionBoxStartX, selectionBoxStartY;

var selectionBox;
var helper;

var drawingCanvas = document.getElementById("drawingCanvas");
var context = drawingCanvas.getContext("2d");
drawingCanvas.width = window.innerWidth;
drawingCanvas.height = window.innerHeight;
var main = document.getElementById("main");
var mini = document.getElementById("mini");

// viewport
var insetWidth;
var insetHeight;
var linepositions = [];
var linecolors = [];

//selection
var pickedObjects = [];

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

function updateMiniCamera() {
    minicamera.zoom = camera.zoom;
    minicamera.position.copy(camera.position);
    minicamera.quaternion.copy(camera.quaternion);
}

function selectedTool() {
    let radio = document.getElementsByName("tools");
    for (let x = 0; x < radio.length; x++) {
        if (radio[x].checked) {
            return radio[x].value;
        }
    }
}

function deselectIfNeeded() {
    if (tempgroup) {
        var tempArray = [];
        for (var i = 0; i < tempgroup.children.length; i++) {
            var children = tempgroup.children[i]
            var position = new THREE.Vector3();
            position = children.getWorldPosition(position);
            children.position.copy(position);
            //Rotation definitly doesn't work. It's difficult to work with because
            //it requires me to reset the rotation center in the center of the tempgroup
            //which is a mess so I'll see if I can live without it
            /*var quaternion = new THREE.Quaternion();
            quaternion = children.getWorldQuaternion(position);
            children.quaternion.copy(quaternion);*/
            children.needsUpdate = true;
            dashMaterial(false, children.material);
            tempArray.push(children);
        }

        tempArray.forEach(object => scene.add(object))
        //tempArray = [];
        transformControls.detach();
        transforming = false;
        //transformControls.dispose();
        scene.remove(transformControls);

        scene.remove(tempgroup);
        tempgroup = null;
    }

    for (var item of selectionBox.collection) {
        dashMaterial(false, item.material);
    }
}

function computeGroupCenter() {
    var center = new THREE.Vector3();
    var children = tempgroup.children;
    var count = children.length;
    for (var i = 0; i < count; i++) {
        center.add(children[i].position);
    }
    center.divideScalar(count);
    return center;
}

function dashMaterial(bool, material) {
    material.dashed = bool;
    // dashed is implemented as a defines -- not as a uniform. this could be changed.
    // ... or THREE.LineDashedMaterial could be implemented as a separate material
    // temporary hack - renderer should do this eventually
    if (bool) material.defines.USE_DASH = "";
    else delete material.defines.USE_DASH;
    material.dashSize = bool ? 0.01 : 100;
    material.gapSize = bool ? 0.01 : 100;
    material.dashScale = bool ? 1 : 100;
    material.needsUpdate = true;
}

function init() {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x333333, 1.0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    main.appendChild(renderer.domElement);

    minirenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
    });
    minirenderer.setPixelRatio(window.devicePixelRatio);
    minirenderer.setClearColor(0x000000, 1);
    minirenderer.setSize(300, 300);
    mini.appendChild(minirenderer.domElement);

    scene = new THREE.Scene();

    /*var axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    var size = 1;
    var divisions = 1;
    var gridHelper = new THREE.GridHelper(size, divisions);
    scene.add(gridHelper);*/

    camera = new THREE.OrthographicCamera(
        window.innerWidth / -2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        window.innerHeight / -2,
        1,
        3
    );
    camera.position.set(0, 0, 2);
    controls = new OrbitControls(camera, minirenderer.domElement);
    controls.enabled = true;
    controls.minDistance = 1;
    controls.maxDistance = 3;
    camera.zoom = 900;
    controls.zoomEnabled = false;
    controls.panEnabled = true;
    transformControls = new TransformControls(camera, drawingCanvas);

    //minicamera = new THREE.OrthographicCamera( 300 / - 2, 300 / 2, 300 / 2, 300 / - 2, 1, 3 );
    minicamera = new THREE.OrthographicCamera();
    minicamera.position.copy(camera.position);
    minicamera.zoom = 75;

    var positions = [];
    var colors = [];

    // Position and THREE.Color Data
    positions.push(0, 0, 0);
    positions.push(0.4, 0.4, 0.4);
    colors.push(255, 0, 0);
    colors.push(255, 0, 0);

    // Line2 ( LineGeometry, LineMaterial )
    var geometry = new LineGeometry();
    //geometry.setDrawRange( 0, 100);
    //geometry.maxInstancedCount = 100;
    geometry.setPositions(
        positions,
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setColors(colors);
    matLine = new LineMaterial({
        color: 0xffffff,
        linewidth: 5, // in pixels
        vertexColors: true,
        //resolution:  // to be set by renderer, eventually
        depthWrite: false
    });
    materials.push(matLine);
    line = new Line2(geometry, matLine);
    //Recentering geometry around the central point
    line.position.set(
        line.geometry.boundingSphere.center.x,
        line.geometry.boundingSphere.center.y,
        line.geometry.boundingSphere.center.z
    );
    line.geometry.center();
    line.needsUpdate = true;
    line.computeLineDistances();
    line.scale.set(1, 1, 1);
    scene.add(line);


    var positions = [];
    var colors = [];

    // Position and THREE.Color Data
    positions.push(0.4, 0, 0);
    positions.push(0, 0.4, 0.4);
    colors.push(255, 0, 0);
    colors.push(255, 0, 0);
    // Line2 ( LineGeometry, LineMaterial )
    var geometry = new LineGeometry();
    //geometry.setDrawRange( 0, 100);
    //geometry.maxInstancedCount = 100;
    geometry.setPositions(
        positions,
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setColors(colors);
    matLine = new LineMaterial({
        color: 0xffffff,
        linewidth: 5, // in pixels
        vertexColors: true,
        //resolution:  // to be set by renderer, eventually
        depthWrite: false
    });
    materials.push(matLine);
    line = new Line2(geometry, matLine);
    //Recentering geometry around the central point
    line.position.set(
        line.geometry.boundingSphere.center.x,
        line.geometry.boundingSphere.center.y,
        line.geometry.boundingSphere.center.z
    );
    line.geometry.center();
    line.needsUpdate = true;
    line.computeLineDistances();
    line.scale.set(1, 1, 1);
    scene.add(line);


    selectionBox = new SelectionBox(camera, scene);
    helper = new SelectionHelper(selectionBox, renderer, "selectBox");
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
    //controls.update();
    updateMiniCamera();
    requestAnimationFrame(animate);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    minirenderer.setViewport(0, 0, 300, 300);
    // renderer will set this eventually

    //matLine.resolution.set(window.innerWidth, window.innerHeight); // resolution of the viewport
    if (materials) {
        materials.forEach(material =>
            material.resolution.set(window.innerWidth, window.innerHeight)
        );
    } // resolution of the inset viewport

    renderer.render(scene, camera);
    minirenderer.render(scene, minicamera);
}

function onTapMove(event) {
    mouse.updateCoordinates(event);
    //DRAW
    if (selectedTool() == "draw") {
        //Draw on canvas
        context.lineTo(mouse.cx, mouse.cy);
        context.stroke();
        //Add line elements
        var vNow = new THREE.Vector3(mouse.tx, mouse.ty, 0);
        vNow.unproject(camera);
        linepositions.push(vNow.x, vNow.y, vNow.z);
        linecolors.push(255, 255, 0);
    }
    //ERASER
    else if (selectedTool() == "erase") {
        raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
        var object = raycaster.intersectObjects(scene.children)[0].object;

        if (object.type === "AxesHelper" || object.type === "GridHelper") {
        } else {
            scene.remove(object);
        }
        //SELECT
    }
    //SELECT
    else if (selectedTool() == "select") {
        if (!transforming) {
            context.rect(
                selectionBoxStartX,
                selectionBoxStartY,
                -(selectionBoxStartX - mouse.cx),
                -(selectionBoxStartY - mouse.cy)
            );
            context.stroke();
            //Clears context inside
            context.clearRect(
                selectionBoxStartX,
                selectionBoxStartY,
                -(selectionBoxStartX - mouse.cx),
                -(selectionBoxStartY - mouse.cy)
            );
            //Clears context outside?!
            //context.clearRect(???)

            if (helper.isDown) {
                for (var i = 0; i < selectionBox.collection.length; i++) {
                    dashMaterial(true, selectionBox.collection[i].material);
                }

                selectionBox.endPoint.set(mouse.tx, mouse.ty, 0.5);
                var allSelected = selectionBox.select();

                for (var i = 0; i < allSelected.length; i++) {
                    dashMaterial(false, allSelected[i].material);
                }
            }
        }
    }
}

function onTapEnd(event) {
    //handler if it's a touch event
    mouse.updateCoordinates(event);
    //DRAW
    if (selectedTool() == "draw") {
        //render line
        context.lineTo(mouse.cx, mouse.cy);
        context.stroke();
        context.closePath();
        context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        //Close and add line to scene
        var matLineDrawn = new LineMaterial({
            color: 0xffffff,
            linewidth: 5, // in pixels
            vertexColors: true,
            //resolution set later,
            depthWrite: true
        });
        materials.push(matLineDrawn);
        var vNow = new THREE.Vector3(mouse.tx, mouse.ty, 0);
        vNow.unproject(camera);
        linepositions.push(vNow.x, vNow.y, vNow.z);
        linecolors.push(255, 255, 0);
        var geometry = new LineGeometry();
        geometry.setPositions(linepositions);
        geometry.setColors(linecolors);
        line = new Line2(geometry, matLineDrawn);
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
        scene.add(line);
        //Remove listener and clear arrays
        linepositions = [];
        linecolors = [];
    }
    //ERASER
    else if (selectedTool() == "erase") {
    }
    //SELECT
    else if (selectedTool() == "select") {

        var allSelected = selectionBox.select();

        if (transformControls.object && !transforming) {
            deselectIfNeeded();
        }

        if (!transforming) {
            context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            selectionBox.endPoint.set(mouse.tx, mouse.ty, 0.5);

            if (allSelected.length >= 1) {
                //Create a temporary group
                tempgroup = new THREE.Group();
                //Add all the selected elements to the temporary groups
                for (var i = 0; i < allSelected.length; i++) {
                    dashMaterial(true, allSelected[i].material);
                    tempgroup.add(allSelected[i]);
                }
                //Attach controls to the temporary group
                //transformControls = new TransformControls(camera, drawingCanvas);
                transformControls.attach(tempgroup);
                //Calculate center between the elements of the group
                transformControls.position.set(
                    computeGroupCenter().x,
                    computeGroupCenter().y,
                    computeGroupCenter().z
                );
                //transformControls.mode = "rotate";
                transformControls.space = "local";

                transformControls.addEventListener("mouseDown", function () {
                    transforming = true;
                    console.log(transforming)
                });
                transformControls.addEventListener("mouseUp", function () {
                    transforming = false;
                    console.log(transforming)
                });
                scene.add(transformControls);
                scene.add(tempgroup);
            }
        }
    }
    drawingCanvas.removeEventListener("touchmove", onTapMove, false);
    drawingCanvas.removeEventListener("mousemove", onTapMove, false);
}

function onTapStart(event) {
    if (event.which == 3) return;

    mouse.updateCoordinates(event);
    //DRAW
    if (selectedTool() == "draw") {
        //draw line
        context.beginPath();
        context.lineWidth = "1";
        context.strokeStyle = "white";
        context.moveTo(mouse.cx, mouse.cy);
        //Start
        var vNow = new THREE.Vector3(mouse.tx, mouse.ty, 0);
        vNow.unproject(camera);
        linepositions.push(vNow.x, vNow.y, vNow.z);
        linecolors.push(255, 255, 0);
    }
    //ERASER
    else if (selectedTool() == "erase") {
        raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = 30;
        raycaster.linePrecision = 0.01;
    }
    //SELECT
    else if (selectedTool() == "select") {

        if (!transforming) {
            //Start a selection if we are not transforming
            selectionBoxStartX = mouse.cx;
            selectionBoxStartY = mouse.cy;
            context.beginPath();
            selectionBox.startPoint.set(mouse.tx, mouse.ty, 0.5);
        }
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
