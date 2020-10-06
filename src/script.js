import * as THREE from "../build/three.module.js";
// import { OrbitControls } from "../build/OrbitControls.js";
import CameraControls from "../build/CameraControls.js";
import { OrbitControls } from "../build/OrbitControls.js";
import { TransformControls } from "../build/TransformControls.js";
import {
    MeshLine,
    MeshLineMaterial,
    //MeshLineRaycast
} from '../build/meshline.js';
import { GLTFExporter } from '../build/GLTFExporter.js';
import Vue from '../build/vue.esm.browser.js';

var app = new Vue({
    el: '#app',
    data: {
        selectedTool: 'draw', //Options are 'draw', 'erase', 'select'
        selectedTransformation: 'translate', //Options are "translate", "rotate" and "scale"
        isAGroupSelected: false, //Transform tools must be restricted if true
        selectedColor: 'lightest', //buffer from the selector so it can be genericized
        lineColor: getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest'), //Rgb value
        lineWidth: 3, //Default 3
        selectedTheme: 'blueprint', //Options are 'blueprint', 'light', 'dark'
        linesNeedThemeUpdate: false,
        controlsLocked: false,
        mirror: false,
        autoRotate: false,
        selection: {}, //to be filled from init
        exportTo: {},
        ui: {
            show: true,
            theme: '',
        },
        modal: {
            show: false,
            mode: 'loader', //modal, loader
            title: 'Saving your drawing',
            helptext: 'This might take a moment, please be patient',
            image: ''
        },
        toast: {
            show: false,
            text: "Selection duplicated"
        },
        experimental: new URL(document.URL).hash == "#experimental" ? true : false,
        zDepth: 0, //this value is inverted in the code
    },
    watch: {
        selectedTool: function () {
            //on tool change we always deselect
            app.selection.deselect();
            picking.resetPicking();
        },
        selectedColor: function () {
            switch (true) {
                case (app.selectedColor == "lightest"):
                    app.lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest');
                    break;
                case (app.selectedColor == "light"):
                    app.lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-light');
                    break;
                case (app.selectedColor == "medium"):
                    app.lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-medium');
                    break;
                case (app.selectedColor == "dark"):
                    app.lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-dark');
                    break;
                default:
                    app.lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest'); //safe
            }
        },
        zDepth: function () {
            line.drawingPlane.position.copy(new THREE.Vector3(directControls.target.x, directControls.target.y, -app.zDepth + (app.lineWidth / 1500) / 2).unproject(camera));
        }
    },
    methods: {
        duplicateSelected: function () {
            app.selection.duplicate()
            app.toast.show = true;
            app.toast.text = "Selection duplicated";
            setTimeout(function () {
                app.toast.show = false;
            }, 700)
        },
        deselect: function () {
            app.selection.deselectFromButton()
        },
        resetCamera: function () {
            directControls.dampingFactor = 0.5
            directControls.enabled = false;
            directControls.setLookAt(0, 0, 2, 0, 0, 0, true)
            directControls.enabled = true;
            setTimeout(() => { directControls.dampingFactor = 10 }, 100)
            //controls.reset();
        },
        toggleUi: function () {
            app.ui.show = !app.ui.show;
        },
        //MOUSE HANDLERS
        onTapStart: function (event) {

            if (event.touches && event.touches.length > 1 || app.selection.selected.length > 0) { return }

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
        },
        onTapMove: function (event) {

            if (event.touches && event.touches.length > 1) { return }

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
    },
    mounted() {
        document.getElementById('welcome').style.zIndex = -1;
        var element = document.getElementById("welcome")
        element.parentNode.removeChild(element);
    }
});

Vue.component("modal", {
    //mode: loading, image
    //title:
    //helpText
    //img
    props: ['mode', 'title', 'helptext', 'source'],
    template: `
    <div class="modal-mask">
        <div class="modal-wrapper">
            <div class="modal-container">

                <div v-if="mode == 'modal'" class="modal-body">
                    <slot name="body">
                        <div class="modal-left-column">
                            <img :src="source" class="saveImg" id="saveImg">
                        </div>
                        <div class="modal-right-column">
                        
                        <div class="modal-header">
                            <slot name="header">
                                {{title}}
                            </slot>
                        </div>

                        <div class="modal-helptext">
                            <slot name="helptext">
                                {{helptext}}
                            </slot>
                        </div>
                        <div class="primaryButton modal-button" @click="$emit('close')">
                            Done
                        </div>
                        </div>
                    </slot>
                </div>

                <div v-else class="modal-body modal-centered">
                            <div class="modal-header">
                                <slot name="header">
                                {{title}}
                                </slot>
                            </div>

                            <div class="modal-helptext">
                                <slot name="helptext">
                                    {{helptext}}
                                </slot>
                            </div>
                </div>

            </div>
        </div>
    </div>
`
});

Vue.component("toast", {
    props: ['text'],
    template: `
<div class="toast">{{text}}</div>
`
});

var renderer, miniAxisRenderer, scene, miniAxisScene, pickingScene, camera, miniAxisCamera;
var controls, directControls, transformControls;
CameraControls.install({ THREE: THREE });
let clock;

var paths = []; //For canvas rendering of selection and eraser

var insetWidth;
var insetHeight;
var linesNeedThemeUpdate = false;

//GIF MAKING VARS
let gif;
let makingGif = false;
let count = 0;
let gifLength = 120;
let bufferRenderer;

//Save image vars
const encodedImageWidth = 800;
let encodedImageHeigth = 300; //for safety
const encodedImageDataStartingAt = 500;

var drawingCanvas = document.getElementById("drawingCanvas");
var context = drawingCanvas.getContext("2d");
drawingCanvas.width = window.innerWidth;
drawingCanvas.height = window.innerHeight;
var main = document.getElementById("main");
var miniAxis = document.getElementById("miniAxis");

let mouse = {
    down: false,
    tx: 0, //x coord for threejs
    ty: 0, //y coord for threejs
    cx: 0, //x coord for canvas
    cy: 0, //y coord for canvas
    smoothing: function () {
        if (app.lineWidth <= 3 && (line.render.geometry && line.render.geometry.vertices.length > 6)) { return 5 } else { return 1 }
    }, //Smoothing can create artifacts if it's too high. Might need to play around with it
    updateCoordinates: function (event) {
        if (event.touches
            &&
            new THREE.Vector2(event.changedTouches[0].pageX, event.changedTouches[0].pageY).distanceTo(new THREE.Vector2(this.cx, this.cy)) > this.smoothing()
        ) {
            this.tx = (event.changedTouches[0].pageX / window.innerWidth) * 2 - 1;
            this.ty = -(event.changedTouches[0].pageY / window.innerHeight) * 2 + 1;
            this.cx = event.changedTouches[0].pageX;
            this.cy = event.changedTouches[0].pageY;
        }
        else {
            if (
                event.button == 0
                &&
                new THREE.Vector2(event.clientX, event.clientY).distanceTo(new THREE.Vector2(this.cx, this.cy)) > this.smoothing()
            ) {
                this.tx = (event.clientX / window.innerWidth) * 2 - 1;
                this.ty = -(event.clientY / window.innerHeight) * 2 + 1;
                this.cx = event.clientX;
                this.cy = event.clientY;
            }
        }
    }
};

let line = {
    start: function () {
        this.render.start(mouse.tx, mouse.ty, -app.zDepth, true, app.lineColor, app.lineWidth, app.mirror);
    },
    move: function () {
        this.render.update(mouse.tx, mouse.ty, -app.zDepth, true);
    },
    end: function () {
        this.render.end();
    },
    render: {
        line: null,
        geometry: null,
        uuid: null,
        start: function (x, y, z, unproject, lineColor, lineWidth, mirrorOn) {
            var vNow = new THREE.Vector3(x, y, z);
            if (unproject) { vNow.unproject(camera) };
            this.geometry = new THREE.Geometry();
            this.line = new MeshLine();
            var material = new MeshLineMaterial({
                lineWidth: lineWidth / 3000, //kind of eyballing it
                sizeAttenuation: 1,
                color: new THREE.Color(lineColor),
                side: THREE.DoubleSide,
                fog: true,
                //resolution: new THREE.Vector2(insetWidth, insetHeight)
            });
            var mesh = new THREE.Mesh(this.line.geometry, material);
            //mesh.raycast = MeshLineRaycast;
            scene.add(mesh);

            mesh.userData.lineColor = lineColor;
            mesh.userData.lineWidth = lineWidth;

            switch (mirrorOn) {
                case "x":
                    mirror.object(mesh, 'x')
                    break;
                case "y":
                    mirror.object(mesh, 'y')
                    break;
                case "z":
                    mirror.object(mesh, 'z')
                    break;
                default:
                //it's false, do nothing
            }

            mesh.layers.set(1);
            this.uuid = mesh.uuid;
        },
        update: function (x, y, z, unproject) {
            //It might be possible to smooth the line drawing with and ongoing rendering of a CatmullRomCurve https://threejs.org/docs/#api/en/extras/curves/CatmullRomCurve3
            var vNow = new THREE.Vector3(x, y, z);
            if (unproject) { vNow.unproject(camera) };
            this.geometry.vertices.push(vNow);
            this.setGeometry();
        },
        end: function () {
            this.geometry.userData = this.geometry.vertices;
            this.setGeometry('mouseup');
            //reset
            this.line = null;
            this.geometry = null;
            this.uuid = null;
        },
        setGeometry(mouseup) {
            this.line.setGeometry(this.geometry, function (p) {
                return Math.pow(2 * p * (1 - p), 0.5) * 4
            });

            if (mouseup) {
                var mesh = scene.getObjectByProperty('uuid', this.uuid);
                mesh.position.set(
                    mesh.geometry.boundingSphere.center.x,
                    mesh.geometry.boundingSphere.center.y,
                    mesh.geometry.boundingSphere.center.z
                );
                this.geometry.center();
                this.setGeometry();
                this.geometry.verticesNeedsUpdate = true;
                this.geometry.needsUpdate = true;

                if (mesh.userData.mirror) {
                    mirror.updateMirrorOf(mesh);
                }
            }
        },
        fromVertices(vertices, lineColor, lineWidth, mirrorOn, returnLineBool) {
            line.render.start(vertices[0].x, vertices[0].y, vertices[0].z, false, lineColor, lineWidth, mirrorOn);
            for (var i = 1; i < vertices.length; i++) {
                line.render.update(vertices[i].x, vertices[i].y, vertices[i].z, false)
            }
            var l = scene.getObjectByProperty('uuid', this.uuid);
            line.render.end();
            if (returnLineBool == true) {
                return l;
            }
        },
    },
    drawingPlane: null, //defined in init
    addDrawingPlane: function () {
        var geometry = new THREE.PlaneGeometry(1, 1, 1);
        var material = new THREE.MeshBasicMaterial({ color: new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg-color')), transparent: true, opacity: 0.8, fog: false });
        var planeBg = new THREE.Mesh(geometry, material);
        var planeGrid = new THREE.GridHelper(
            1,
            1,
            new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--line-color-light')),
            new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--line-color-light'))
        );
        planeGrid.rotation.x = Math.PI / 2;
        this.drawingPlane = new THREE.Group();
        this.drawingPlane.add(planeBg);
        this.drawingPlane.add(planeGrid);
        scene.add(this.drawingPlane);
        // controls.addEventListener("change", function () {
        //     line.drawingPlane.position.copy(new THREE.Vector3(directControls.target.x, directControls.target.y, -app.zDepth + (app.lineWidth / 1500) / 2).unproject(camera));
        // });
    },
    updateDrawingPlane: function () {
        this.drawingPlane.rotation.copy(camera.rotation);
        //camera zoom has a minimum of 450 and a maximum of infinity
    }
};

//What I should do to improve picking performance is: 
//Get previous mouse coordinates and current mouse coordinates
//Pass them to the Picker
//Have the picker render the rectangle between these two coordinates
//Inside of the rectangle grab all the points connecting the two angles directly
//check every pixel agains their ID

class GPUPickHelper {
    constructor() {
        this.pickingTexture = new THREE.WebGLRenderTarget();
        this.pixelBuffer = new Uint8Array(4);
        this.pickedObject = null;
        this.pickedObjectSavedColor = 0;
    }
    calcPointsInBetween(x1, y1, x2, y2) {
        var coordinatesArray = new Array();
        // Define differences and error check
        var dx = Math.abs(x2 - x1);
        var dy = Math.abs(y2 - y1);
        var sx = (x1 < x2) ? 1 : -1;
        var sy = (y1 < y2) ? 1 : -1;
        var err = dx - dy;
        // Set first coordinates
        coordinatesArray.push(new THREE.Vector2(x1, y1));
        // Main loop
        while (!((x1 == x2) && (y1 == y2))) {
            var e2 = err << 1;
            if (e2 > -dy) {
                err -= dy;
                x1 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y1 += sy;
            }
            // Set coordinates
            coordinatesArray.push(new THREE.Vector2(x1, y1));
        }
        // Return the result
        return coordinatesArray;
    }
    pick(cssPosition, scene, camera) {
        const { pickingTexture, pixelBuffer } = this;

        // set the view offset to represent just a single pixel under the mouse
        const pixelRatio = renderer.getPixelRatio();
        camera.setViewOffset(
            renderer.getContext().drawingBufferWidth,   // full width
            renderer.getContext().drawingBufferHeight,  // full top
            cssPosition.x * pixelRatio | 0,             // rect x
            cssPosition.y * pixelRatio | 0,             // rect y
            1,                                          // rect width
            1,                                          // rect height
        );
        // render the scene
        renderer.setRenderTarget(pickingTexture)
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        // clear the view offset so rendering returns to normal
        camera.clearViewOffset();
        //read the pixel
        renderer.readRenderTargetPixels(
            pickingTexture,
            0,   // x
            0,   // y
            1,   // width
            1,   // height
            pixelBuffer);

        const id =
            (pixelBuffer[0] << 16) |
            (pixelBuffer[1] << 8) |
            (pixelBuffer[2]);
        const intersectedObject = picking.idToObject[id];

        if (intersectedObject) {
            return intersectedObject
        }
    }
    pickArea(x1, y1, x2, y2, scene, camera) {
        const { pickingTexture, pixelBuffer } = this;
        const width = () => {
            if (x2 - x1 < 0) { return -(x2 - x1) }
            else if (x2 - x1 == 0) { return 1 }
            else { return x2 - x1 }
        }
        const height = () => {
            if (y2 - y1 < 0) { return -(y2 - y1) }
            else if (y2 - y1 == 0) { return 1 }
            else { return y2 - y1 }
        }
        let intersectObjects = new Array();

        // set the view offset to represent just a single pixel under the mouse
        const pixelRatio = renderer.getPixelRatio();
        camera.setViewOffset(
            renderer.getContext().drawingBufferWidth,   // full width
            renderer.getContext().drawingBufferHeight,  // full top
            x1 * pixelRatio | 0,             // rect x
            y1 * pixelRatio | 0,             // rect y
            width() * pixelRatio | 1,        // height
            height() * pixelRatio | 1,        // width
        );
        // render the scene
        this.pickingTexture.setSize(width(), height())
        renderer.setRenderTarget(pickingTexture)
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        // clear the view offset so rendering returns to normal
        camera.clearViewOffset();
        //read the pixel

        this.calcPointsInBetween(0, 0, width(), height()).forEach(point => {
            renderer.readRenderTargetPixels(
                this.pickingTexture,
                point.x,   // x
                point.y,   // y
                1,   // width
                1,   // height
                pixelBuffer);
            const id =
                (pixelBuffer[0] << 16) |
                (pixelBuffer[1] << 8) |
                (pixelBuffer[2]);
            const intersectedObject = picking.idToObject[id];
            if (intersectedObject != undefined && intersectObjects.indexOf(intersectedObject) < 0) {
                intersectObjects.push(intersectedObject)
            }
        })
        return intersectObjects

    }
}
let picking = {
    scene: null,
    idToObject: {},
    id: 1,
    picker: new GPUPickHelper(),
    setupPicking: function () {
        console.log("setupPicking")
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0);
        scene.children.forEach(children => {
            if (children.layers.mask == 2) {
                var clone = children.clone();
                var cloneMaterial = children.material.clone();
                clone.material = cloneMaterial;
                cloneMaterial.color = new THREE.Color(this.id);
                this.scene.add(clone);
                this.idToObject[this.id] = children;
                this.id = this.id + 1;
            }
        })
    },
    resetPicking: function () {
        console.log("resetPicking")
        if (this.scene != null) {
            this.idToObject = {};
            this.id = 1;
            this.scene.children.forEach(children => {
                scene.remove(children);
                children.material.dispose()
            })
        }
    }
}

let eraser = {
    linepaths: [],
    color: getComputedStyle(document.documentElement).getPropertyValue('--accent-color'),
    start: function () {
        picking.setupPicking();
        var intersectedObject = picking.picker.pick({ x: mouse.cx, y: mouse.cy }, picking.scene, camera);
        if (intersectedObject) {
            scene.remove(intersectedObject);
            mirror.eraseMirrorOf(intersectedObject);
            intersectedObject.material.dispose();
        }
        this.linepaths.push([mouse.cx, mouse.cy]);
    },
    move: function () {
        this.linepaths[this.linepaths.length - 1].push([mouse.cx, mouse.cy]);
        this.redrawLine('rgba(255,255,255)');

        var intersectedObject = picking.picker.pick({ x: mouse.cx, y: mouse.cy }, picking.scene, camera);
        if (intersectedObject) {
            scene.remove(intersectedObject);
            mirror.eraseMirrorOf(intersectedObject);
            intersectedObject.material.dispose();
        }
    },
    end: function () {
        picking.resetPicking();
        context.closePath();
        context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        this.linepaths = [];
    },
    redrawLine: function (color) {
        context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        context.strokeStyle = color;
        context.globalAlpha = 0.25;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 30;
        context.beginPath();
        for (var i = 0; i < this.linepaths.length; ++i) {
            var path = this.linepaths[i];
            if (this.linepaths.length < 1)
                continue;
            context.moveTo(path[0][0], path[0][1]);
            for (var j = 1; j < path.length; ++j)
                context.lineTo(path[j][0], path[j][1]);
        }
        context.stroke();
    },
};

app.selection = {
    array: [],
    selection: [],
    selected: [],
    helper: undefined,
    group: undefined,
    transforming: function () {
        if (transformControls.userData.hover) {
            return transformControls.userData.hover
        } else { return false }
    },
    linepaths: new Array(),
    color: getComputedStyle(document.documentElement).getPropertyValue('--accent-color'),
    start: function () {
        if (this.transforming() === false) {

            console.log('start')

            this.linepaths.push(new THREE.Vector2(mouse.cx, mouse.cy));
            picking.setupPicking();
            var vNow = new THREE.Vector3(mouse.tx, mouse.ty, 0);
            vNow.unproject(camera);

            this.deselect()
            var pickedObjects = picking.picker.pickArea(
                mouse.cx - 5,
                mouse.cy - 5,
                mouse.cx + 5,
                mouse.cy + 5,
                picking.scene,
                camera);

            if (pickedObjects != undefined && pickedObjects.length > 0) {
                pickedObjects.forEach(object => {
                    if (this.selection.indexOf(object) < 0 && this.selected.indexOf(object) < 0) {
                        this.selection.push(object);
                        this.toggleSelectionColor(object, true);
                    }
                })
            }

        }
    },
    move: function () {
        if (this.transforming() === false && this.selected.length == 0) {

            var pickedObjects = picking.picker.pickArea(
                this.linepaths[this.linepaths.length - 1].x,
                this.linepaths[this.linepaths.length - 1].y,
                mouse.cx,
                mouse.cy,
                picking.scene,
                camera);

            if (pickedObjects != undefined && pickedObjects.length > 0) {
                pickedObjects.forEach(object => {
                    if (this.selection.indexOf(object) < 0 && this.selected.indexOf(object) < 0) {
                        this.selection.push(object);
                        this.toggleSelectionColor(object, true);
                    }
                })
            }
            this.linepaths.push(new THREE.Vector2(mouse.cx, mouse.cy));
            this.redrawLine(this.color);

        }
    },
    end: function () {
        context.closePath();
        context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        this.linepaths = new Array();
        picking.resetPicking();

        if (this.transforming() === false) {
            if (this.selection.length == 0 || this.selected.length > 0) {
                this.deselect()
            } else {
                this.select(this.selection)
            }
        }
    },
    duplicate: function () {
        //it's a group
        if (this.selected.length > 1) {
            var sourcePosition = this.group.position;
            var duplicateArray = [];
            console.log(app.selection.selection);
            this.selected.forEach(object => {
                var duplicate = object.clone();
                duplicate.layers.set(1);
                //duplicate.raycast = MeshLineRaycast;
                var duplicateMaterial = object.material.clone();
                duplicate.material = duplicateMaterial;
                duplicateArray.push(duplicate);
                scene.add(duplicate);
                mirror.object(duplicate, duplicate.userData.mirrorAxis);
            })
            console.log(duplicateArray);
            //deselect selected group
            this.deselect();
            app.selection.selection = duplicateArray;
            app.selection.selection.forEach(element => {
                this.toggleSelectionColor(element, true)
            })
            this.select(app.selection.selection);
            // this.group.position.set(
            //     sourcePosition.x + 0.1,
            //     sourcePosition.y,
            //     sourcePosition.z
            // );
            this.helper.update();
            mirror.updateMirrorOf(this.group);
        }
        //it's a single objet
        else if (this.selected.length == 1) {
            var duplicate = this.selected[0].clone();
            var originalPosition = duplicate.position;
            var duplicateMaterial = duplicate.material.clone();
            duplicate.material = duplicateMaterial;
            // duplicate.position.set(
            //     originalPosition.x + 0.1,
            //     originalPosition.y,
            //     originalPosition.z
            // )
            scene.add(duplicate);
            //duplicate.raycast = MeshLineRaycast;
            mirror.object(duplicate, duplicate.userData.mirrorAxis);
            //deselect selected object
            this.deselect();
            this.selection.push(duplicate);
            this.select(this.selection);
            this.selection = [];
            this.helper.update();
        }
    },
    select: function (selection) {
        //selection can not be zero so it's either 1 or more than 1
        //It's a single element
        if (selection.length == 1) {
            this.helper = new THREE.BoxHelper(selection[0], new THREE.Color(this.color));
            scene.add(this.helper);
            transformControls = new TransformControls(camera, drawingCanvas);
            transformControls.attach(selection[0]);
            transformControls.addEventListener("objectChange", function () {
                mirror.updateMirrorOf(app.selection.selected[0])
            });
            this.selected.push(selection[0])
            this.helper.update();
        }
        //It's a group
        else {
            this.group = new THREE.Group();
            scene.add(this.group);
            this.helper = new THREE.BoxHelper(this.group, new THREE.Color(this.color));
            scene.add(this.helper);
            //calculate where is the center for the selected objects so we can set the center of the group before we attach objects to it;
            var center = new THREE.Vector3();
            selection.forEach(obj => {
                center.add(obj.position);
            })
            center.divideScalar(selection.length);
            this.group.position.set(center.x, center.y, center.z);
            //Clone all the elements in the selection to the temporary groups
            selection.forEach(element => {
                var clone = element.clone()
                scene.add(clone);
                this.group.attach(clone);
                clone.userData.uuid = element.uuid;
                clone.visible = false;
                this.selected.push(element);
            })
            this.helper.update();
            transformControls = new TransformControls(camera, drawingCanvas);
            transformControls.attach(this.group);
        }
        transformControls.addEventListener("objectChange", function () {
            app.selection.helper.update();
            transformControls.object.children.forEach(obj => {
                var position = new THREE.Vector3();
                obj.getWorldPosition(position);
                var quaternion = new THREE.Quaternion();
                obj.getWorldQuaternion(quaternion);
                var scale = new THREE.Vector3();
                obj.getWorldScale(scale);
                var selectedObj = scene.getObjectByProperty('uuid', obj.userData.uuid);
                selectedObj.position.set(position.x, position.y, position.z)
                selectedObj.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
                selectedObj.scale.set(scale.x, scale.y, scale.z)
                mirror.updateMirrorOf(selectedObj)
            });
        });
        scene.add(transformControls);
        this.selection = [];
    },
    deselect: function () {
        //tooltip on top of object
        //https://stackoverflow.com/questions/54410532/how-to-correctly-position-html-elements-in-three-js-coordinate-system
        // var posX = (this.selected[0].position.x * window.innerWidth) / 2 + 1;
        // var posY = (this.selected[0].position.y * window.innerHeight) / 2 + 1;
        // var x = (this.selected[0].geometry.boundingBox.max.x * window.innerWidth) / 2 + 1;
        // var y = (this.selected[0].geometry.boundingBox.max.y * window.innerHeight) / 2 + 1;
        // var position = new THREE.Vector3(posX + x, posY + y, 0).project(camera)
        // document.getElementById('toolbar').style.left = position.x + "px";
        // document.getElementById('toolbar').style.top = position.y + "px";

        transformControls.detach();
        scene.remove(transformControls);
        scene.remove(this.helper);

        switch (true) {
            case (this.selected.length == 0):
                break;
            case (this.selected.length == 1):

                this.toggleSelectionColor(this.selected[0], false);

                break;
            case (this.selected.length > 1):
                var ungroupArray = [];

                for (var i = 0; i < this.selected.length; i++) {
                    var obj = this.selected[i];
                    this.toggleSelectionColor(obj, false);
                }

                scene.remove(this.group);
                this.group = undefined;

                break;
            default:
        }
        this.selected = [];
        this.selection = [];
    },
    toggleSelectionColor: function (object, bool) {
        if (bool) {
            object.material.color = new THREE.Color(this.color);
        } else {
            object.material.color = new THREE.Color(object.userData.lineColor);
        }
    },
    computeGroupCenter: function () {
        var center = new THREE.Vector3();
        var children = app.selection.group.children;
        var count = children.length;
        for (var i = 0; i < count; i++) {
            center.add(children[i].position);
        }
        center.divideScalar(count);
        return center;
    },
    redrawLine: function (color) {
        context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        context.strokeStyle = color;
        context.globalAlpha = 0.25;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 15;
        context.beginPath();
        for (var i = 0; i < this.linepaths.length; ++i) {
            context.lineTo(this.linepaths[i].x, this.linepaths[i].y);
        }
        context.stroke();
    },
};

let mirror = {
    updateMirrorOf: function (obj) {
        if (obj.type === 'Group') {
            obj.children.forEach(obj => {
                mirror.updateMirrorOf(obj)
            })
        } else if (obj.userData.mirror) {
            //let's check if there's a matching mirror object otherwise we do nothing
            let mirroredObject = scene.getObjectByProperty('uuid', obj.userData.mirror);
            var position = new THREE.Vector3();
            obj.getWorldPosition(position);
            var quaternion = new THREE.Quaternion();
            obj.getWorldQuaternion(quaternion);
            var scale = new THREE.Vector3();
            obj.getWorldScale(scale);
            switch (obj.userData.mirrorAxis) {
                case "x":
                    mirroredObject.position.set(-position.x, position.y, position.z)
                    mirroredObject.quaternion.set(-quaternion.x, quaternion.y, quaternion.z, -quaternion.w)
                    mirroredObject.scale.set(-scale.x, scale.y, scale.z)
                    break;
                case "y":
                    mirroredObject.position.set(position.x, -position.y, position.z)
                    mirroredObject.quaternion.set(quaternion.x, -quaternion.y, quaternion.z, -quaternion.w)
                    mirroredObject.scale.set(scale.x, -scale.y, scale.z)
                    break;
                case "z":
                    mirroredObject.position.set(position.x, position.y, -position.z)
                    mirroredObject.quaternion.set(quaternion.x, quaternion.y, -quaternion.z, -quaternion.w)
                    mirroredObject.scale.set(scale.x, scale.y, -scale.z)
                    break;
                default:
                    return
            }
            obj.matrixWorldNeedsUpdate = true;
        }
    },
    object: function (obj, axis) {
        console.log('mirror')
        var clone = obj.clone();
        clone.layers.set(1);
        //clone.raycast = MeshLineRaycast;
        clone.userData.mirror = obj.uuid;
        clone.userData.mirrorAxis = axis;
        obj.userData.mirror = clone.uuid;
        obj.userData.mirrorAxis = axis;
        switch (axis) {
            case "x":
                clone.applyMatrix(obj.matrixWorld.makeScale(-1, 1, 1));
                break;
            case "y":
                clone.applyMatrix(obj.matrixWorld.makeScale(1, -1, 1));
                break;
            case "z":
                clone.applyMatrix(obj.matrixWorld.makeScale(1, 1, -1));
                break;
            default:
                return
        }
        scene.add(clone);
    },
    eraseMirrorOf: function (obj) {
        if (obj.userData.mirror) {
            let mirroredObject = scene.getObjectByProperty('uuid', obj.userData.mirror);
            scene.remove(mirroredObject);
        }
    }
};

//TODO improvements to the save and restore:
//the image should maintain the correct aspect ratio
let importFrom = {
    imageWithEncodedFile: function () {
        console.log('importing')
        var replacementValues = ["!", "\"", "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?", "@", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "[", "\\", "]", "^", "_", "`", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "{", "|", "}", "~"];
        var input, file, fr;
        var input = document.createElement('input');
        input.style.display = 'none';
        input.type = 'file';
        document.body.appendChild(input);

        input.onchange = event => {
            app.modal.show = true;
            app.modal.mode = 'loader';
            app.modal.title = "Loading your drawing from image";
            app.modal.helptext = "This might take a while, please be patient";
            //The ensure a somewhat decent cross-browser compatibility, pngcrush is used for browsers (at the moment only Firefox) that don't handle color-profiles well.

            //FIREFOX
            if (navigator.userAgent.indexOf("Firefox") > 0 || navigator.userAgent.indexOf("Chrome") > 0) {
                var instance = new pngcrush();
                instance.exec(event.target.files[0], function (event) {
                    console.log(event.data.line);
                }).then(function (event) {
                    // Done processing the image, display file size and output image
                    var outputFile = new Blob([event.data.data], { type: 'image/png' });
                    var img = new Image();
                    img.onload = () => {
                        var canvasWithEncodedImage = document.createElement('canvas');
                        canvasWithEncodedImage.width = encodedImageWidth;
                        canvasWithEncodedImage.height = img.height;
                        canvasWithEncodedImage.style.zIndex = 5;
                        canvasWithEncodedImage.style.position = 'absolute';
                        canvasWithEncodedImage.style.top = '10px';
                        canvasWithEncodedImage.style.right = '10px';
                        var ctx = canvasWithEncodedImage.getContext("2d");
                        ctx.imageSmoothingEnabled = false;
                        ctx.oImageSmoothingEnabled = false;
                        ctx.webkitImageSmoothingEnabled = false;
                        ctx.msImageSmoothingEnabled = false;
                        ctx.clearRect(0, 0, encodedImageWidth, img.height);
                        ctx.drawImage(img, 0, 0);
                        decode(canvasWithEncodedImage, ctx);
                    }
                    img.src = URL.createObjectURL(outputFile);
                });
                //NOT FIREFOX
            } else {
                var img = new Image();
                img.onload = () => {
                    console.log('img loaded')
                    var canvasWithEncodedImage = document.createElement('canvas');
                    canvasWithEncodedImage.width = encodedImageWidth;
                    canvasWithEncodedImage.height = img.height;
                    canvasWithEncodedImage.style.zIndex = 5;
                    canvasWithEncodedImage.style.position = 'absolute';
                    canvasWithEncodedImage.style.top = '10px';
                    canvasWithEncodedImage.style.right = '10px';
                    var ctx = canvasWithEncodedImage.getContext("2d");
                    ctx.imageSmoothingEnabled = false;
                    ctx.oImageSmoothingEnabled = false;
                    ctx.webkitImageSmoothingEnabled = false;
                    ctx.msImageSmoothingEnabled = false;
                    ctx.clearRect(0, 0, encodedImageWidth, img.height);
                    ctx.drawImage(img, 0, 0);
                    decode(canvasWithEncodedImage, ctx);
                };
                img.src = URL.createObjectURL(event.target.files[0]);
            }
        }
        input.click();
        function decode(canvas, ctx) {
            var json = '';
            for (var y = encodedImageDataStartingAt; y < canvas.height; y++) {
                for (var x = 0; x < canvas.width; x++) {
                    json = json + replacementValues[ctx.getImageData(x, y, 1, 1).data[0]];
                    if (json.slice(-2) == '}]') {
                        importFrom.json(json);
                        return
                    };
                    json = json + replacementValues[ctx.getImageData(x, y, 1, 1).data[1]];
                    if (json.slice(-2) == '}]') {
                        importFrom.json(json);
                        return
                    };
                    json = json + replacementValues[ctx.getImageData(x, y, 1, 1).data[2]];
                    if (json.slice(-2) == '}]') {
                        importFrom.json(json);
                        return
                    };
                }
            }

        }
    },
    json: function (json) {
        console.log(json);
        var json = JSON.parse(json);
        var lightestColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest');
        var lightColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-light');
        var mediumColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-medium');
        var darkColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-dark');
        json.forEach(importedLine => {
            if (importedLine.g.length > 1) { //Let's make sure there are at least 2 points in the line
                var vertices = [];

                for (var i = 0; i < importedLine.g.length; i = i + 3) {
                    vertices.push(new THREE.Vector3().fromArray(importedLine.g, i))
                }


                var color;
                switch (true) {
                    case (importedLine.c == 0):
                        color = lightestColor;
                        break;
                    case (importedLine.c == 1):
                        color = lightColor;
                        break;
                    case (importedLine.c == 2):
                        color = mediumColor;
                        break;
                    case (importedLine.c == 3):
                        color = darkColor;
                        break;
                    default:
                        color = lightestColor; //safe
                }

                var l = line.render.fromVertices(
                    vertices,
                    color,
                    importedLine.w,
                    importedLine.a,
                    true);

                l.position.set(
                    importedLine.p.x,
                    importedLine.p.y,
                    importedLine.p.z
                );
                l.quaternion.set(
                    importedLine.q._x,
                    importedLine.q._y,
                    importedLine.q._z,
                    importedLine.q._w,
                );
                l.scale.set(
                    importedLine.s.x,
                    importedLine.s.y,
                    importedLine.s.z
                );

                mirror.updateMirrorOf(l);
            };
        })
        app.modal.show = false;
    }
};

app.exportTo = {
    json: async function () {
        var itemProcessed = 0;
        var json = [];
        var mirroredObject = [];
        var lightestColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest');
        var lightColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-light');
        var mediumColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-medium');
        var darkColor = getComputedStyle(document.documentElement).getPropertyValue('--line-color-dark');
        scene.children.forEach(obj => {
            //check if it's a line, if it's in the right layer and that we don't already have its original
            if (obj.geometry && obj.geometry.type == "MeshLine" && obj.layers.mask == 2 && mirroredObject.indexOf(obj.uuid) == -1) {
                var line = {};
                line.c = 0;
                var color = obj.userData.lineColor;
                console.log(color === lightColor);
                //console.log(getComputedStyle(document.documentElement).getPropertyValue('--line-color-light'));
                //To enable theming, colors should be stored as numbers: 0 is lightest, 1 is light, 2 is medium, 3 is dark.
                switch (true) {
                    case (color === lightestColor):
                        line.c = 0;
                        break;
                    case (color === lightColor):
                        line.c = 1;
                        break;
                    case (color === mediumColor):
                        line.c = 2;
                        break;
                    case (color === darkColor):
                        line.c = 3;
                        break;
                    default:
                        return //already defined a
                }
                line.w = obj.userData.lineWidth;
                line.g = [];
                obj.geometry.vertices.forEach(vector3 => {
                    line.g.push(vector3.x);
                    line.g.push(vector3.y);
                    line.g.push(vector3.z);
                });

                var position = new THREE.Vector3();
                position = obj.getWorldPosition(position);
                line.p = position;

                var quaternion = new THREE.Quaternion();
                quaternion = obj.getWorldQuaternion(quaternion);
                line.q = quaternion;

                var scale = new THREE.Vector3();
                scale = obj.getWorldScale(scale);
                line.s = scale;

                if (obj.userData.mirror) {
                    //Push the id of the mirrored line in the array to exclude mirrors
                    mirroredObject.push(obj.userData.mirror);
                };
                //This is all we need to restore its mirror, the renderLine takes care of it
                if (obj.userData.mirrorAxis) { line.a = obj.userData.mirrorAxis };

                json.push(line);
            }
            itemProcessed = itemProcessed + 1;
            if (itemProcessed >= scene.children.length) {
                return
            }
        });
        return json
    },
    geometry: function () {
        app.selection.deselect();
        //Essentially this function creates a new scene from scratch, iterates through all the line2 in Scene 1, converts them to line1 that the GLTF exporter can export and Blender can import and exports the scene. Then deletes the scene.
        var scene2 = new THREE.Scene();
        function exportGLTF(input) {
            var gltfExporter = new GLTFExporter();
            var options = {
            };
            gltfExporter.parse(input, function (result) {
                if (result instanceof ArrayBuffer) {
                    saveArrayBuffer(result, 'scene.glb');
                } else {
                    var output = JSON.stringify(result, null, 2);
                    // console.log(output);
                    saveString(output, 'scene.gltf');
                }
            }, options);

            scene2.traverse(object => {
                if (!object.isMesh) return

                console.log('dispose geometry!')
                object.geometry.dispose()

                if (object.material.isMaterial) {
                    cleanMaterial(object.material)
                } else {
                    // an array of materials
                    for (const material of object.material) cleanMaterial(material)
                }
            })
            const cleanMaterial = material => {
                console.log('dispose material!')
                material.dispose()
                // dispose textures
                for (const key of Object.keys(material)) {
                    const value = material[key]
                    if (value && typeof value === 'object' && 'minFilter' in value) {
                        console.log('dispose texture!')
                        value.dispose()
                    }
                }
            }
            scene2.dispose();
        }
        var link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link); // Firefox workaround, see #6594
        function save(blob, filename) {
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            // URL.revokeObjectURL( url ); breaks Firefox...
        }
        function saveString(text, filename) {
            save(new Blob([text], {
                type: 'text/plain'
            }), filename);
        }
        function saveArrayBuffer(buffer, filename) {
            save(new Blob([buffer], {
                type: 'application/octet-stream'
            }), filename);
        }
        //may need to scale up a bit
        function convertMeshLinetoLine() {
            var itemProcessed = 0;
            scene.children.forEach(obj => {
                if (obj.geometry && obj.geometry.type == "MeshLine" && obj.layers.mask == 2) {
                    var material = new THREE.LineBasicMaterial({
                        color: obj.material.color,
                        linewidth: obj.material.linewidth
                    });
                    var geometry = new THREE.BufferGeometry().setFromPoints(obj.geometry.vertices);
                    var convertedLine = new THREE.Line(geometry, material);
                    var position = obj.getWorldPosition(position);
                    var quaternion = obj.getWorldQuaternion(quaternion);
                    var scale = obj.getWorldScale(scale);
                    convertedLine.position.set(position.x, position.y, position.z)
                    convertedLine.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
                    convertedLine.scale.set(scale.x, scale.y, scale.z)
                    scene2.add(convertedLine);
                    convertedLine.geometry.center();
                }
                itemProcessed = itemProcessed + 1;
                if (itemProcessed === scene.children.length) {
                    exportGLTF(scene2);
                }
            })
        }
        convertMeshLinetoLine()
    },
    mesh: function () {
        //It might be possible to extrude lines into meshes to allow exporting into meshes like here https://threejs.org/docs/#api/en/extras/curves/CatmullRomCurve3
    },
    gif: function () {
        app.selection.deselect();

        app.modal.show = true;
        app.modal.mode = 'loader';
        app.modal.title = "Making you a gif";
        app.modal.helptext = "This might take a moment, please be patient";

        makingGif = true;
        app.autoRotate = true;
        controls.autoRotateSpeed = 30.0;

        gif = new GIF({
            workers: 10,
            quality: 10,
            workerScript: '../build/gif.worker.js'
        });

        gif.on("finished", function (blob) {
            app.modal.title = "Here’s your gif";
            app.modal.helptext = "Long press on the picture on tablet or right click on desktop to save it.";
            app.modal.mode = "modal";
            app.modal.image = URL.createObjectURL(blob);
            console.log("rendered");
            app.autoRotate = false;
        });
    },
    image: function () {
        //nothing yet
    },
    imageWithEncodedFile: function () {
        app.selection.deselect();
        app.modal.mode = 'loader';
        app.modal.title = "Saving your drawing";
        app.modal.helptext = "This might take a moment, please be patient";
        app.modal.show = true;

        app.exportTo.json().then(function (json) {

            function encodeImage() {
                json = JSON.stringify(json);
                //generate stringified json from scene
                var replacementValues = ["!", "\"", "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?", "@", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "[", "\\", "]", "^", "_", "`", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "{", "|", "}", "~"];
                renderer.render(scene, camera);
                var imgData = renderer.domElement.toDataURL();
                var img = new Image();
                //Do a quick calulation of the height of the image based on how many characters are in the JSON
                encodedImageHeigth = encodedImageDataStartingAt + Math.ceil((json.length / 3) / encodedImageWidth);
                var canvasWithEncodedImage = document.createElement('canvas');
                canvasWithEncodedImage.width = encodedImageWidth;
                canvasWithEncodedImage.height = encodedImageHeigth;
                var ctx = canvasWithEncodedImage.getContext("2d");
                img.src = imgData;
                img.onload = function () {
                    var pixels = [];
                    for (var i = 0, charsLength = json.length; i < charsLength; i += 3) {
                        var pixel = {};
                        pixel.r = replacementValues.indexOf(json.substring(i, i + 1));
                        pixel.g = replacementValues.indexOf(json.substring(i + 1, i + 2));
                        pixel.b = replacementValues.indexOf(json.substring(i + 2, i + 3));
                        // pixel.a = replacementValues.indexOf(json.substring(i + 3, i + 4));
                        pixels.push(pixel);
                    }
                    var count = 0
                    for (var y = encodedImageDataStartingAt; y < encodedImageHeigth; y++) {
                        for (var x = 0; x < canvasWithEncodedImage.width; x++) {
                            if (count < pixels.length) {
                                ctx.fillStyle = "rgb(" +
                                    pixels[count].r
                                    + "," +
                                    pixels[count].g
                                    + "," +
                                    pixels[count].b
                                    + ")";
                                ctx.fillRect(x, y, 1, 1);
                                count = count + 1;
                            } else {
                                app.modal.mode = 'modal';
                                app.modal.title = 'Save this picture, it’s your save file';
                                app.modal.helptext = 'Long press on the picture on tablet or right click on desktop to save. The bottom part of this picture contains all the data needed to recreate your 3d sketch, so don’t compress it or modify it.';

                                var hRatio = canvasWithEncodedImage.width / img.width;
                                var vRatio = canvasWithEncodedImage.height / img.height;
                                var ratio = Math.min(hRatio, vRatio);
                                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');
                                ctx.fillRect(0, 0, encodedImageWidth, encodedImageDataStartingAt);
                                ctx.drawImage(img,
                                    0,
                                    0,
                                    img.width,
                                    img.height,
                                    padding,
                                    padding,
                                    (img.width * ratio) - padding * 2,
                                    (img.height * ratio) - padding * 2
                                );
                                let blueprintImage = { width: encodedImageWidth, height: encodedImageDataStartingAt }
                                var padding = 10;
                                ctx.imageSmoothingEnabled = false;
                                ctx.oImageSmoothingEnabled = false;
                                ctx.webkitImageSmoothingEnabled = false;
                                ctx.msImageSmoothingEnabled = false;
                                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest');
                                ctx.strokeRect(padding, padding, blueprintImage.width - padding * 2, encodedImageDataStartingAt - padding * 2);
                                var infoBox = { height: 100, width: 250 };
                                ctx.beginPath();
                                ctx.moveTo(
                                    blueprintImage.width - infoBox.width,
                                    blueprintImage.height - infoBox.height
                                );
                                ctx.lineTo(
                                    blueprintImage.width - padding - 1,
                                    blueprintImage.height - infoBox.height
                                );
                                ctx.stroke();

                                ctx.beginPath();
                                ctx.moveTo(
                                    blueprintImage.width - infoBox.width,
                                    blueprintImage.height - infoBox.height
                                );
                                ctx.lineTo(
                                    blueprintImage.width - infoBox.width,
                                    blueprintImage.height - padding - 2
                                );
                                ctx.stroke();
                                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest');
                                ctx.font = "12px Courier New";
                                ctx.fillText("Format │ blueprint.png", blueprintImage.width - infoBox.width + padding, blueprintImage.height - infoBox.height + (padding * 1.7));
                                ctx.beginPath();
                                ctx.moveTo(
                                    blueprintImage.width - infoBox.width,
                                    blueprintImage.height - infoBox.height + (padding * 3)
                                );
                                ctx.lineTo(
                                    blueprintImage.width - padding - 1,
                                    blueprintImage.height - infoBox.height + (padding * 3)
                                );
                                ctx.stroke();
                                ctx.fillText(" Date  │ " + new Date().toLocaleDateString(), blueprintImage.width - infoBox.width + padding, blueprintImage.height - infoBox.height + (padding * 4.8));
                                ctx.beginPath();
                                ctx.moveTo(
                                    blueprintImage.width - infoBox.width,
                                    blueprintImage.height - infoBox.height + (padding * 6)
                                );
                                ctx.lineTo(
                                    blueprintImage.width - padding - 1,
                                    blueprintImage.height - infoBox.height + (padding * 6)
                                );
                                ctx.stroke();
                                ctx.fillText("▉▉▉▉▉▉▉.▉▉▉", blueprintImage.width - infoBox.width + padding, blueprintImage.height - infoBox.height + (padding * 7.8));
                                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest');
                                ctx.font = "15px Courier New";
                                ctx.fillText("DO NOT MODIFY", 20, 30);
                                ctx.fillText("DO NOT COMPRESS", blueprintImage.width - 155, 30);
                                ctx.fillText("DO NOT MODIFY", 20, blueprintImage.height - (padding * 2.3));
                                app.modal.image = canvasWithEncodedImage.toDataURL("image/png");
                            }
                        }
                    }
                };
            }
            setTimeout(encodeImage, 500); //This is a bad hack to account for the fact that Chrome and Firefox do not show the modal properly. I assume it has something to do with the fact that the encode image function is overwhelming;
        });

    }
}

init();
animate();


function init() {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    main.appendChild(renderer.domElement);
    renderer.domElement.id = 'threeJsCanvas';

    miniAxisRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    miniAxisRenderer.setPixelRatio(window.devicePixelRatio);
    miniAxisRenderer.setClearColor(new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--ui-bg-color')), 0.4);
    miniAxisRenderer.setSize(150, 150);
    miniAxis.appendChild(miniAxisRenderer.domElement);

    scene = new THREE.Scene();
    //Set the background based on the css variable;
    var bgCol = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');
    scene.background = new THREE.Color(bgCol);
    scene.fog = new THREE.Fog(bgCol, 2, 3);
    miniAxisScene = new THREE.Scene();

    var axesHelper = new THREE.AxesHelper();
    axesHelper.layers.set(0);
    axesHelper.material.fog = false;
    scene.add(axesHelper);

    var axesHelperFlipped = new THREE.AxesHelper();
    axesHelperFlipped.applyMatrix4(new THREE.Matrix4().makeScale(-1, -1, -1));
    axesHelperFlipped.layers.set(0);
    axesHelperFlipped.material.fog = false;
    scene.add(axesHelperFlipped);

    drawAxisHelperControls();

    var size = 1;
    var divisions = 1;
    var gridHelper = new THREE.GridHelper(size, divisions);
    gridHelper.layers.set(0);
    gridHelper.material.fog = false;
    scene.add(gridHelper);

    camera = new THREE.OrthographicCamera(
        window.innerWidth / -2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        window.innerHeight / -2,
        0,
        4
    );
    camera.layers.enable(0); // enabled by default
    camera.layers.enable(1);
    camera.zoom = 900;
    camera.position.set(0, 0, 2);

    clock = new THREE.Clock();

    directControls = new CameraControls(camera, drawingCanvas);
    directControls.dampingFactor = 10
    directControls.mouseButtons.left = CameraControls.ACTION.NONE
    directControls.mouseButtons.right = CameraControls.ACTION.DOLLY
    directControls.touches.one = CameraControls.ACTION.NONE
    directControls.mouseButtons.wheel = CameraControls.ACTION.ROTATE
    directControls.touches.one = CameraControls.ACTION.NONE
    directControls.touches.two = CameraControls.ACTION.ROTATE
    directControls.touches.three = CameraControls.ACTION.TOUCH_DOLLY_TRUCK

    controls = new OrbitControls(camera, miniAxisRenderer.domElement);
    controls.rotateSpeed = 0.4;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.saveState();

    var geometry = new THREE.SphereBufferGeometry(0.003, 32, 32);
    var material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    var targetSphere = new THREE.Mesh(geometry, material);
    scene.add(targetSphere);

    //small hack to have OrbitControls and CameraControls work together
    directControls.addEventListener("update", () => {
        let target = new THREE.Vector3();
        target = directControls.getTarget(target);
        var x = target.x;
        var y = target.y;
        var z = target.z;
        controls.target = target;
        targetSphere.position.set(target.x, target.y, target.z)
    })

    transformControls = new TransformControls(camera, drawingCanvas);

    miniAxisCamera = new THREE.OrthographicCamera();
    miniAxisCamera.position.copy(camera.position);
    //miniAxisCamera.zoom = 750;
    miniAxisCamera.layers.enable(0);
    miniAxisCamera.layers.enable(1);

    if (app.experimental) {
        line.addDrawingPlane()
    }

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);
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

    renderer.render(scene, camera);
    miniAxisRenderer.render(miniAxisScene, miniAxisCamera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.left = 900 * camera.aspect / - 2;
    camera.right = 900 * camera.aspect / 2;
    camera.top = 900 / 2;
    camera.bottom = - 900 / 2;

    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    drawingCanvas.width = window.innerWidth;
    drawingCanvas.height = window.innerHeight;

    insetWidth = window.innerHeight / 4;
    insetHeight = window.innerHeight / 4;
}

function animate() {
    updateminiAxisScene();

    if (app.experimental) {
        line.updateDrawingPlane();
    }

    const delta = clock.getDelta();

    let hasdirectControlsUpdated
    if (directControls.enabled == true) {
        hasdirectControlsUpdated = directControls.update(delta);
    }

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
    miniAxisRenderer.setViewport(0, 0, 150, 150);
    renderer.render(scene, camera);
    miniAxisRenderer.render(miniAxisScene, miniAxisCamera);

    if (makingGif) {
        if (count < gifLength) {
            bufferRenderer.render(scene, camera)
            gif.addFrame(bufferRenderer.domElement, {
                copy: true,
                delay: 60
            });
            count = count + 1;
        } else {
            app.autoRotate = false;
            controls.autoRotateSpeed = 30.0;
            makingGif = false;
            gif.render();
            count = 0;
        }
    }

}

function checkIfHelperObject(object) {
    if (object.type === "AxesHelper" || object.type === "GridHelper" || object.type === "Object3D") {
        return true
    } else { return false }
}

//CAMERA CONTROLS
function updateminiAxisScene() {
    miniAxisScene.quaternion.copy(camera.quaternion).inverse()
}

function drawAxisHelperControls() {

    let size = 0.9;
    let distance = size / 2;

    var front = new THREE.TextureLoader().load("../img/sides/front.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: front, overdraw: true, color: 0x0099ff });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, distance)
    plane.name = "z"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var back = new THREE.TextureLoader().load("../img/sides/back.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: back, overdraw: true, color: 0x0099ff });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, -distance)
    plane.rotation.y = Math.PI;
    plane.name = "-z"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var top = new THREE.TextureLoader().load("../img/sides/top.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: top, overdraw: true, color: 0x99ff00 });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, distance, 0)
    plane.rotation.x = Math.PI / 2;
    plane.rotation.y = Math.PI;
    plane.rotation.z = Math.PI;
    plane.name = "y"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var bottom = new THREE.TextureLoader().load("../img/sides/bottom.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: bottom, overdraw: true, color: 0x99ff00 });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, -distance, 0)
    plane.rotation.x = Math.PI / 2;
    plane.name = "-y"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var right = new THREE.TextureLoader().load("../img/sides/right.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: right, overdraw: true, color: 0xff6600 });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(distance, 0, 0)
    plane.rotation.y = Math.PI / 2;
    plane.rotation.z = Math.PI;
    plane.rotation.x = Math.PI;
    plane.name = "x"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var left = new THREE.TextureLoader().load("../img/sides/left.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: left, overdraw: true, color: 0xff6600 });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(-distance, 0, 0)
    plane.rotation.y = -Math.PI / 2;
    plane.rotation.z = Math.PI;
    plane.rotation.x = Math.PI;
    plane.name = "-x"
    plane.layers.set(1);
    miniAxisScene.add(plane);


    miniAxisRenderer.domElement.addEventListener("mousedown", () => {
        directControls.enabled = false;
    }, false)
    miniAxisRenderer.domElement.addEventListener("touchstart", () => {
        directControls.enabled = false;
    }, false)

    miniAxisRenderer.domElement.addEventListener("mousemove", () => {
        if (directControls.enabled == false) {
            miniAxisMouse.moved = true;
        }
    }, false)
    miniAxisRenderer.domElement.addEventListener("touchmove", () => {
        if (directControls.enabled == false) {
            miniAxisMouse.moved = true;
        }
    }, false)

    miniAxisRenderer.domElement.addEventListener("mouseup", (event) => {
        directControls.enabled = true;
        console.log(miniAxisMouse.moved)
        if (miniAxisMouse.moved == true) {
            directControls.setLookAt(camera.position.x, camera.position.y, camera.position.z, controls.target.x, controls.target.y, controls.target.z, false)
        } else {
            repositionCamera(event)
        }
        miniAxisMouse.moved = false;
    }, false)
    miniAxisRenderer.domElement.addEventListener("touchend", (event) => {
        directControls.enabled = true;
        if (miniAxisMouse.moved == true) {
            directControls.setLookAt(camera.position.x, camera.position.y, camera.position.z, controls.target.x, controls.target.y, controls.target.z, false)
        } else {
            repositionCamera(event)
        }
        miniAxisMouse.moved = false;
    }, false)

}
let miniAxisMouse = {
    tx: 0, //x coord for threejs
    ty: 0, //y coord for threejs
    moved: false,
    updateCoordinates: function (event) {
        let canvasBounds = miniAxisRenderer.getContext().canvas.getBoundingClientRect();
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

            let target = new THREE.Vector3();
            target = directControls.getTarget(target);
            var x = target.x;
            var y = target.y;
            var z = target.z;

            switch (object.name) {
                case 'z':
                    directControls.dampingFactor = 0.5
                    directControls.enabled = false;
                    directControls.setLookAt(target.x, target.y, target.z + 2, target.x, target.y, target.z, true)
                    directControls.enabled = true;
                    setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                    break;
                case 'x':
                    directControls.dampingFactor = 0.5
                    directControls.enabled = false;
                    directControls.setLookAt(target.x + 2, target.y, target.z, target.x, target.y, target.z, true)
                    directControls.enabled = true;
                    setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                    break;
                case 'y':
                    directControls.dampingFactor = 0.5
                    directControls.enabled = false;
                    directControls.setLookAt(target.x, target.y + 2, target.z, target.x, target.y, target.z, true)
                    directControls.enabled = true;
                    setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                    break;
                case '-x':
                    directControls.dampingFactor = 0.5
                    directControls.enabled = false;
                    directControls.setLookAt(target.x - 2, target.y, target.z, target.x, target.y, target.z, true)
                    directControls.enabled = true;
                    setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                    break;
                case '-y':
                    directControls.dampingFactor = 0.5
                    directControls.enabled = false;
                    directControls.setLookAt(target.x, target.y - 2, target.z, target.x, target.y, target.z, true)
                    directControls.enabled = true;
                    setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                    break;
                case '-z':
                    directControls.dampingFactor = 0.5
                    directControls.enabled = false;
                    directControls.setLookAt(target.x, target.y, target.z - 2, target.x, target.y, target.z, true)
                    directControls.enabled = true;
                    setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                    break;
                default:
            }

        }
    }
};

document.getElementById("Load").addEventListener("click", importFrom.imageWithEncodedFile);
