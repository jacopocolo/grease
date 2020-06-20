import * as THREE from "/js/vendor/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://threejs.org/examples/jsm/controls/TransformControls.js";
import { Line2 } from "https://threejs.org/examples/jsm/lines/Line2.js";
import { LineMaterial } from "https://threejs.org/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "https://threejs.org/examples/jsm/lines/LineGeometry.js";
import { GLTFExporter } from 'https://threejs.org/examples/jsm/exporters/GLTFExporter.js';
// import { ColladaExporter } from 'https://threejs.org/examples/jsm/exporters/ColladaExporter.js';
// import { OBJLoader } from 'https://threejs.org/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'https://threejs.org/examples/jsm/loaders/GLTFLoader.js';
import Vue from 'https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue.esm.browser.js';

var app = new Vue({
    el: '#app',
    data: {
        selectedTool: 'draw', //Options are 'draw', 'erase', 'select'
        selectedTransformation: 'translate', //Options are "translate", "rotate" and "scale"
        isAGroupSelected: false, //Transform tools must be restricted if true
        lineColor: 'rgb(255, 255, 255)', //Rgb value
        lineWidth: 10, //Default 10
        lineWidthEl: undefined, //filled in mount()
        selectedTheme: 'blueprint', //Options are 'blueprint', 'light', 'dark'
        linesNeedThemeUpdate: false,
        controlsLocked: false,
        mirror: false,
        autoRotate: false,
        selection: undefined, //to be filled from init
        lineWidthDragging: false,
        startX: 0,
        x: 'no',
        y: 'no'
    },
    watch: {
        selectedTheme: function () {
            app.linesNeedThemeUpdate = true;
        },
        selectedTool: function () {
            //on tool change we always deselect
            app.selection.deselect();
            //re-add event listeners after a switch
            // if (app.selectedTool == 'draw') {
            //     this.lineWidthEl.addEventListener('mousedown', this.lineWidthStartDrag);
            //     this.lineWidthEl.addEventListener('touchstart', this.lineWidthStartDrag);
            // }
        },
        lineWidth: function () {
            if (this.lineWidth < 3) {
                this.lineWidth = 3;
            } else if (this.lineWidth > 40) {
                this.lineWidth = 40;
            }
        }
    },
    methods: {
        duplicateSelected: function () {
            app.selection.duplicate()
        },
        lineWidthStartDrag() {
            document.addEventListener('mouseup', this.lineWidthStopDrag);
            document.addEventListener('mousemove', this.lineWidthdonDrag);
            document.addEventListener('touchend', this.lineWidthStopDrag);
            document.addEventListener('touchmove', this.lineWidthdonDrag);
            drawingCanvas.removeEventListener("touchstart", this.onTapStart, false);
            drawingCanvas.removeEventListener("mousedown", this.onTapStart, false);
            drawingCanvas.removeEventListener("touchmove", this.onTapMove, false);
            drawingCanvas.removeEventListener("mousemove", this.onTapMove, false);
            drawingCanvas.removeEventListener("touchend", this.onTapEnd, false);
            drawingCanvas.removeEventListener("mouseup", this.onTapEnd, false);
            this.lineWidthDragging = true;
            this.x = this.y = 0;
            this.startX = event.pageX;
        },
        lineWidthdonDrag(event) {
            if (this.lineWidthDragging) {
                this.x = event.pageX;
                this.y = event.pageY;
                this.lineWidth = this.lineWidth + -(this.startX - this.x) / 50;
            }
        },
        lineWidthStopDrag() {
            this.lineWidthDragging = false;
            this.x = this.y = 'no';
            document.removeEventListener('mouseup', this.lineWidthStopDrag);
            document.removeEventListener('mousemove', this.lineWidthdonDrag);
            document.removeEventListener('touchend', this.lineWidthStopDrag);
            document.removeEventListener('touchmove', this.lineWidthdonDrag);
            drawingCanvas.addEventListener("touchstart", this.onTapStart, false);
            drawingCanvas.addEventListener("mousedown", this.onTapStart, false);

        },
        //MOUSE HANDLERS
        onTapMove: function (event) {
            mouse.updateCoordinates(event);
            //DRAW
            if (this.selectedTool == "draw") {
                line.move();
            }
            //ERASER
            else if (this.selectedTool == "erase") {
                eraser.move()
            }
            //SELECT
            else if (this.selectedTool == "select") {
                app.selection.move();
            }
        },
        onTapEnd: function (event) {
            //handler if it's a touch event
            mouse.updateCoordinates(event);
            //DRAW
            if (this.selectedTool == "draw") {
                line.end()
            }
            //ERASER
            else if (this.selectedTool == "erase") {
                eraser.end()
            }
            //SELECT
            else if (this.selectedTool == "select") {
                app.selection.end()
            }
            drawingCanvas.removeEventListener("touchmove", this.onTapMove, false);
            drawingCanvas.removeEventListener("mousemove", this.onTapMove, false);
        },
        onTapStart: function (event) {
            if (event.which == 3) return;
            mouse.updateCoordinates(event);
            //DRAW
            if (this.selectedTool == "draw") {
                line.start();
            }
            //ERASER
            else if (this.selectedTool == "erase") {
                eraser.start();
            }
            //SELECT
            else if (this.selectedTool == "select") {
                app.selection.start();
            }
            drawingCanvas.addEventListener("touchmove", this.onTapMove, false);
            drawingCanvas.addEventListener("mousemove", this.onTapMove, false);
            drawingCanvas.addEventListener("touchend", this.onTapEnd, false);
            drawingCanvas.addEventListener("mouseup", this.onTapEnd, false);
        }
    },
    mounted() {
        // this.lineWidthEl = document.getElementById('lineWidth');
        // this.lineWidthEl.addEventListener('mousedown', this.lineWidthStartDrag);
        // this.lineWidthEl.addEventListener('touchstart', this.lineWidthStartDrag);
    }
});

var renderer, miniAxisRenderer, scene, miniAxisScene, camera, miniAxisCamera;
var controls, transformControls;
var matLine, matLineBasic;
var matLineDrawn;
var materials = [];

var paths = [];

//var selection = app.selection;
var transforming;
var raycaster;
var raycastObject;

var insetWidth;
var insetHeight;
var linesNeedThemeUpdate = false;

//GIF MAKING VARS
let gif;
let makingGif = false;
let count = 0;
let gifLength = 60;
let gifBufferCanvas;
let gifBufferCtx;
let gifBufferImage;
let bufferRenderer;

var drawingCanvas = document.getElementById("drawingCanvas");
var context = drawingCanvas.getContext("2d");
drawingCanvas.width = window.innerWidth;
drawingCanvas.height = window.innerHeight;
var main = document.getElementById("main");
var miniAxis = document.getElementById("miniAxis");

//Blueprint is an object that holds a minimal version of the THREEjs scene
//It contains all the positions of the lines that are drawn on canvas
//Their width, colors, positions, rotation and scale
//Lines are deleted if they are deleted from the scene
//Lines positions, rotation and scale are updated when they 
//It is used to produce JSON files that can be saved and restored (redrawn)
//It's also used to produce export files that only contain lines geometry as
//Line2 don't export well using the native THREE exporters
let blueprint = {
    lines: [],
    removeFromBlueprint: function (object) {
        var indexOfElementToRemove = blueprint.lines.map(function (e) { return e.uuid; }).indexOf(object.uuid)
        blueprint.lines.splice(indexOfElementToRemove, 1)
    },
    updateBlueprintLine: function (object) {
        var indexOfObjectToUpdate = blueprint.lines.map(function (e) { return e.uuid; }).indexOf(object.uuid);
        var position = object.getWorldPosition(position);
        console.log(position);
        blueprint.lines[indexOfObjectToUpdate].position = position;
        var quaternion = object.getWorldQuaternion(quaternion);
        console.log(quaternion);
        blueprint.lines[indexOfObjectToUpdate].quaternion = quaternion;
        var scale = object.getWorldScale(scale);
        console.log(scale);
        blueprint.lines[indexOfObjectToUpdate].scale = scale;
    },
};

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

let line = {
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
        this.renderLine(this.linepositions, app.lineColor, app.lineWidth);
        // switch (app.mirror) {
        //     case "x":
        //         this.renderMirroredLine(this.linepositions, 'x');
        //         break;
        //     case "y":
        //         this.renderMirroredLine(this.linepositions, 'y');
        //         break;
        //     case "z":
        //         this.renderMirroredLine(this.linepositions, 'z');
        //         break;
        //     default:
        //         return
        // }
    },
    renderLine: function (positions, lineColor, lineWidth, position, quaternion, scale) {
        var matLineDrawn = new LineMaterial({
            color: new THREE.Color(lineColor),
            linewidth: lineWidth, // in pixels
            vertexColors: false,
            wireframe: false,
            side: THREE.DoubleSide,
            depthWrite: true
        });
        materials.push(matLineDrawn); //this is needed to set the resolution in the renderer properly
        var geometry = new LineGeometry();
        var positions = this.rejectPalm(positions);
        geometry.setPositions(positions);
        var l = new Line2(geometry, matLineDrawn);
        if (position) {
            l.position.set(position.x, position.y, position.z);
        } else {
            l.position.set(
                l.geometry.boundingSphere.center.x,
                l.geometry.boundingSphere.center.y,
                l.geometry.boundingSphere.center.z
            );
        }
        if (quaternion) {
            // l.quaternion.normalize();
            l.applyQuaternion(quaternion)
            l.updateMatrix();
        }
        l.geometry.center();
        l.needsUpdate = true;
        l.computeLineDistances();
        if (scale) {
            l.scale.set(scale.x, scale.y, scale.z)
        } else {
            l.scale.set(1, 1, 1);
        }
        l.layers.set(1);

        var lposition = l.getWorldPosition(lposition);
        var lquaternion = l.getWorldQuaternion(lquaternion);
        var lscale = l.getWorldScale(lscale);
        //Create line object and add it to the blueprint
        // var blueprintLine = {
        //     uuid: l.uuid, geometry: [...positions], material: { color: lineColor, lineWidth: lineWidth },
        //     position: lposition,
        //     quaternion: lquaternion,
        //     scale: lscale,
        // };

        // var blueprintLine = {
        //     uuid: l.uuid, geometry: [...positions], material: { color: lineColor, lineWidth: lineWidth },
        //     position: lposition,
        //     quaternion: lquaternion,
        //     scale: lscale,
        //     //An idea for handling mirror somewhat decently in the save format.
        //     //we store the UUID of the original line, if that original line exists
        //     //we clone and apply the mirror so the two lines maintain the same geometry
        //     //otherwise we draw it from scratch with a new geometry 
        //     mirrorOf: l.uuid
        //     mirrorAxis: 'x'
        // };

        //blueprint.lines.push(blueprintLine);
        scene.add(l);
        let lmirrored;
        switch (app.mirror) {
            case "x":
                lmirrored = l.clone();
                // lmirrored.position.set(-l.position.x, l.position.y, l.position.z)
                // lmirrored.scale.set(-1, 1, 1);
                lmirrored.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
                lmirrored.updateMatrix();
                lmirrored.userData = { mirrorOnAxis: app.mirror };
                scene.add(lmirrored);
                break;
            case "y":
                lmirrored = l.clone();
                lmirrored.position.set(l.position.x, -l.position.y, l.position.z)
                lmirrored.scale.set(1, -1, 1);
                lmirrored.userData = { mirrorOnAxis: app.mirror };
                scene.add(lmirrored);
                break;
            case "z":
                lmirrored = l.clone();
                lmirrored.position.set(l.position.x, l.position.y, -l.position.z)
                lmirrored.scale.set(1, 1, -1);
                lmirrored.userData = { mirrorOnAxis: app.mirror };
                scene.add(lmirrored);
                break;
            default:
                return
        }
        // if (app.mirror == 'x') {
        //     let lmirrored = l.clone();
        //     lmirrored.position.set(-l.position.x, l.position.y, l.position.z)
        //     lmirrored.scale.set(-1, 1, 1);
        //     lmirrored.userData = { mirroredAxis: app.mirror };
        //     scene.add(lmirrored);
        // }
        //Remove listener and clear arrays
    },
    renderMirroredLine: function (positions, axis) {
        var startingPos; //0 for x, 1 for y, 2 for z
        switch (axis) {
            case "x":
                startingPos = 0;
                break;
            case "y":
                startingPos = 1;
                break;
            case "z":
                startingPos = 2;
                break;
            default:
                return
        }
        for (var i = startingPos; i < positions.length; i = i + 3) {
            positions[i] = -positions[i]
        }
        this.renderLine(positions, app.lineColor, app.lineWidth);
    },
    rejectPalm: function (positions) {
        //rudimentary approach to palm rejection
        //if two points are are too far apart
        //they are artifacts of palm rejection failing
        var arr = positions;
        for (var i = 0; i < arr.length - 2; i = i + 2) {
            if (arr.length[i] - arr.length[i + 2] > 0.1) {
                arr = arr.slice(i)
            }
        }
        return arr
    }
}

let eraser = {
    start: function () {
        raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = 0.1;
        raycaster.layers.set(1);
        paths.push([mouse.cx, mouse.cy]);
    },
    move: function () {
        paths[paths.length - 1].push([mouse.cx, mouse.cy]);
        //This is to render line transparency,
        //we are redrawing the line every frame
        this.redrawLine('rgba(255,20,147, 0.15)');

        try {
            raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
            var object = raycaster.intersectObjects(scene.children)[0].object;
            if (checkIfHelperObject(object)) {
            } else {
                //blueprint.removeFromBlueprint(object);
                scene.remove(object);

                scene.children.forEach(sceneObj => {
                    if (sceneObj.geometry.uuid === object.geometry.uuid) {
                        scene.remove(sceneObj);
                        sceneObj.material.dispose();
                        sceneObj.geometry.dispose();
                    }
                })

                object.dispose();

            }
        } catch (err) {
            //if there's an error here, it just means that the raycaster found nothing
        }
    },
    end: function () {
        context.closePath();
        context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        paths = []
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
    },
}

//Selection is defined inside of the app so the UI has access to the state of the selection
//The selection could be refactored significantly using:
//userData (object.userData.selected = true/false)
//scene.getObjectById
//and hopefully https://github.com/mrdoob/three.js/issues/6336#issuecomment-626628464
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
            raycaster.params.Line.threshold = 1;
            try {
                raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
                var intersectObject = raycaster.intersectObjects(scene.children)[0].object;
                if (intersectObject.geometry.type == "LineGeometry"
                    && this.selecting.indexOf(intersectObject) < 0
                ) {
                    this.deselect();
                    toggleDash(intersectObject, true);
                    this.selecting.push(intersectObject);
                }
            } catch (err) {
                //if there's an error here, it just means that the raycaster found nothing
            }
        }
    },
    move: function () {
        //If we are not transforming
        if (!transforming) {
            paths[paths.length - 1].push([mouse.cx, mouse.cy]);
            //This is to render line transparency,
            //we are redrawing the line every frame
            this.redrawLine('rgba(255, 255, 255, 0.15)');
        }
        //If nothing is already selected we add to the selection 
        if (this.current.length === 0) {
            try {
                raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
                var intersectObject = raycaster.intersectObjects(scene.children)[0].object;
                //Check if the object exists, check if it's not an helper object, check if it's already in the tempArray
                if (intersectObject.geometry.type == "LineGeometry"
                    && this.selecting.indexOf(intersectObject) < 0) {
                    toggleDash(intersectObject, true);
                    this.selecting.push(intersectObject);
                }
            } catch (err) {
                //if there's an error here, it just means that the raycaster found nothing  
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
            //this is bad code, I don't need to fire the whole function every time. I can just store the object somewhere and then update the position.
            transformControls.addEventListener("change", function () { mirror.updateMirroredObject(app.selection.current[0]) });
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
                this.current.push(element); //we also add it to the current selection in case we need it for duplication
            })
            //Attach controls to the temporary group
            app.selectedTransformation = 'translate'; //temporary fix to the fact that transform and rotate don't work on groups
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
            transformControls.addEventListener("change", function (event) {
                //console.log(app.selection.group)
                // app.selection.group.children.forEach(object => {
                //     mirror.updateMirroredObject(object);
                // })
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
                this.group.position.x + 0.2,
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
                if (!checkIfHelperObject(object)) {
                    toggleDash(object, false)
                }
                ungroupArray.push(object);
            }
            ungroupArray.forEach(object => {
                scene.add(object);
                mirror.updateMirroredObject(object);
                //blueprint.updateBlueprintLine(object);
            })
            this.current = [];
            this.group = undefined;
            transformControls.detach();
            transforming = false;
            scene.remove(this.group);
        }
        else if (this.current.length == 1) {
            var object = this.current[0];
            //mirror.updateMirroredObject(object);
            //blueprint.updateBlueprintLine(object);
            toggleDash(object, false);
        }
        // transformControls.removeEventListener("change", mirror.updateMirroredObject(app.selection.current[0]));
        transformControls.detach();
        transformControls.dispose();
        this.current = [];

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

let mirror = {
    updateMirroredObject: function (object) {
        var position = object.getWorldPosition(position);
        var quaternion = object.getWorldQuaternion(quaternion);
        var scale = object.getWorldScale(scale);
        scene.children.forEach(sceneObj => {
            //Very complicated way to check if: same geometry but different object
            if (sceneObj.geometry && sceneObj.geometry.uuid == object.geometry.uuid) {
                switch (sceneObj.userData.mirrorOnAxis) {
                    case "x":
                        sceneObj.position.set(-position.x, position.y, position.z)
                        sceneObj.quaternion.set(-quaternion.x, quaternion.y, quaternion.z, -quaternion.w)
                        sceneObj.scale.set(-scale.x, scale.y, scale.z)
                        break;
                    case "y":
                        sceneObj.position.set(position.x, -position.y, position.z)
                        sceneObj.quaternion.set(quaternion.x, -quaternion.y, quaternion.z, -quaternion.w)
                        sceneObj.scale.set(scale.x, -scale.y, scale.z)
                        break;
                    case "z":
                        sceneObj.position.set(position.x, position.y, -position.z)
                        sceneObj.quaternion.set(quaternion.x, quaternion.y, -quaternion.z, -quaternion.w)
                        sceneObj.scale.set(scale.x, scale.y, -scale.z)
                        break;
                    default:
                        return
                }

            }
        })
    }
}

init();
animate();

function init() {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); //transparent so the background shows through
    renderer.setSize(window.innerWidth, window.innerHeight);
    main.appendChild(renderer.domElement);
    renderer.domElement.id = 'threeJsCanvas';

    miniAxisRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
    });
    miniAxisRenderer.setPixelRatio(window.devicePixelRatio);
    miniAxisRenderer.setClearColor(0x000000, 1);
    miniAxisRenderer.setSize(250, 250);
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
    controls.autoRotateSpeed = 30.0;
    camera.zoom = 900;
    controls.zoomEnabled = false;
    controls.panEnabled = false;
    transformControls = new TransformControls(camera, drawingCanvas);

    miniAxisCamera = new THREE.OrthographicCamera();
    miniAxisCamera.position.copy(camera.position);
    miniAxisCamera.zoom = 75;
    miniAxisCamera.layers.enable(0);
    miniAxisCamera.layers.enable(1);

    window.addEventListener("resize", onWindowResize, false);
    onWindowResize();
    drawingCanvas.addEventListener("touchstart", app.onTapStart, false);
    drawingCanvas.addEventListener("mousedown", app.onTapStart, false);

    //EXTRA RENDERER ONLY FOR MAKING GIFS
    bufferRenderer = new THREE.WebGLRenderer({
        antialias: true,
    });
    bufferRenderer.setPixelRatio(window.devicePixelRatio);
    bufferRenderer.setClearColor(0x000000, 0);
    bufferRenderer.setSize(window.innerWidth / 3, window.innerHeight / 3);
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
    miniAxisRenderer.setViewport(0, 0, 250, 250);
    renderer.render(scene, camera);
    if (makingGif) {
        if (count < gifLength) {
            app.autoRotate = true;
            controls.autoRotateSpeed = 30.0;
            bufferRenderer.render(scene, camera)
            gif.addFrame(bufferRenderer.domElement, {
                copy: true,
                delay: 60
            });
            count = count + 1;
        } else {
            gif.render();
            app.autoRotate = false;
            controls.autoRotateSpeed = 30.0;
            makingGif = false;
            count = 0;
        }
    }
    miniAxisRenderer.render(miniAxisScene, miniAxisCamera);
}

//UTILS
function selectedTool() {
    return app.selectedTool;
}

function checkIfHelperObject(object) {
    if (object.type === "AxesHelper" || object.type === "GridHelper" || object.type === "Object3D") {
        return true
    } else { return false }
}

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

function toggleDash(object, bool) {
    var material = object.material;
    material.dashed = bool;
    var ratio = 1000;
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

//CAMERA CONTROLS
function updateminiAxisCamera() {
    miniAxisCamera.zoom = camera.zoom;
    miniAxisCamera.position.copy(camera.position);
    miniAxisCamera.quaternion.copy(camera.quaternion);
}

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

//Allow dechecking of radio buttons
var mirrorRadios = document.getElementsByName('mirror');
var setCheck;
var x = 0;
for (x = 0; x < mirrorRadios.length; x++) {
    mirrorRadios[x].onclick = function () {
        if (setCheck != this) {
            setCheck = this;
        } else {
            this.checked = false;
            app.mirror = false;
            setCheck = null;
        }
    };
}

//SAVE AND LOAD
function save() {
    function download(content, fileName, contentType) {
        var a = document.createElement("a");
        var file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }
    download(JSON.stringify(blueprint), 'blueprint.json', 'json');
}
document.getElementById("Save").addEventListener("click", save);

function load() {
    var input, file, fr;
    var input = document.createElement('input');
    input.style.display = 'none';
    input.type = 'file';
    document.body.appendChild(input);
    input.onchange = event => {
        var selectedFile = event.target.files[0];
        const fileReader = new FileReader();
        fileReader.readAsText(selectedFile, "UTF-8");
        fileReader.onload = () => {
            var data = JSON.parse(fileReader.result);
            data.lines.forEach(obj => { line.renderLine(obj.geometry, obj.material.color, obj.material.lineWidth, obj.position, obj.quaternion, obj.scale) })
        }
        fileReader.onerror = (error) => {
            console.log(error);
        }
    }
    input.click();
}
document.getElementById("Load").addEventListener("click", load);

function makeGif() {
    makingGif = true;

    gif = new GIF({
        workers: 10,
        quality: 10,
        workerScript: 'js/vendor/gif.worker.js'
    });

    gif.on("finished", function (blob) {
        var img = new Image();
        img.src = URL.createObjectURL(blob);
        img.style.zIndex = 5;
        img.style.position = 'absolute';
        img.style.top = '10px';
        img.style.right = '10px';
        img.style.width = window.innerWidth / 3;
        img.style.height = window.innerHeight / 3;
        img.style.border = '1px solid white';
        document.body.appendChild(img);
        console.log("rendered");
        app.autoRotate = false;
    });
}

document.getElementById("makeGif").addEventListener("click", makeGif);