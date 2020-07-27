import * as THREE from "../build/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://threejs.org/examples/jsm/controls/TransformControls.js";
import {
    MeshLine,
    MeshLineMaterial,
    MeshLineRaycast
} from '../build/meshline.js';
import { GLTFExporter } from 'https://threejs.org/examples/jsm/exporters/GLTFExporter.js';
import Vue from 'https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue.esm.browser.js';

var app = new Vue({
    el: '#app',
    data: {
        selectedTool: 'draw', //Options are 'draw', 'erase', 'select'
        selectedTransformation: 'translate', //Options are "translate", "rotate" and "scale"
        isAGroupSelected: false, //Transform tools must be restricted if true
        lineColor: 'rgb(255, 255, 255)', //Rgb value
        lineWidth: 30, //Default 10
        lineWidthEl: undefined, //filled in mount()
        selectedTheme: 'blueprint', //Options are 'blueprint', 'light', 'dark'
        linesNeedThemeUpdate: false,
        controlsLocked: false,
        mirror: false,
        autoRotate: false,
        selection: {}, //to be filled from init
        modal: {
            show: false,
            title: 'This is your save file',
            image: ''
        },
        exportTo: {
            json: async function () {
                var itemProcessed = 0;
                var json = [];
                var mirroredObject = [];
                scene.children.forEach(obj => {
                    //check if it's a line, if it's in the right layer and that we don't already have its original
                    if (obj.geometry && obj.geometry.type == "MeshLine" && obj.layers.mask == 2 && mirroredObject.indexOf(obj.uuid) == -1) {
                        var line = {};
                        line.c = {};
                        //Color could be replaced by a single number 1-4
                        //Where 1 is lightest and 4 is dark
                        //This would reduce the length significantly
                        line.c.r = obj.material.color.r * 255;
                        line.c.g = obj.material.color.g * 255;
                        line.c.b = obj.material.color.b * 255;
                        line.w = obj.material.linewidth;
                        line.g = obj.geometry.userData;

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
            gltf: function () {
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
                function convertLine2toLine() {
                    var itemProcessed = 0;
                    scene.children.forEach(obj => {
                        if (obj.geometry && obj.geometry.type == "LineGeometry" && obj.layers.mask == 2) {
                            var material = new THREE.LineBasicMaterial({
                                color: obj.material.color,
                                linewidth: obj.material.linewidth
                            });
                            var geometry = new THREE.BufferGeometry();
                            var vertices = new Float32Array(obj.geometry.userData);
                            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
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
                convertLine2toLine()
            },
            gif: function () {
                makingGif = true;
                app.autoRotate = true;
                controls.autoRotateSpeed = 30.0;

                gif = new GIF({
                    workers: 10,
                    quality: 10,
                    workerScript: '../build/gif.worker.js'
                });

                gif.on("finished", function (blob) {
                    app.modal.show = true;
                    app.modal.image = URL.createObjectURL(blob);
                    console.log("rendered");
                    app.autoRotate = false;
                });
            },
            image: function () {
                //nothing yet
            },
            imageWithEncodedFile: async function () {
                app.exportTo.json().then(function (json) {
                    json = JSON.stringify(json);
                    function encodeJsonInCanvas(json, ctx) {
                        console.log('Encoding…')
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
                                    app.modal.show = true;
                                    var hRatio = canvasWithEncodedImage.width / img.width;
                                    var vRatio = canvasWithEncodedImage.height / img.height;
                                    var ratio = Math.min(hRatio, vRatio);
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
                                    app.modal.image = canvasWithEncodedImage.toDataURL("image/png");
                                }
                            }
                        }
                    }
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
                    let blueprintImage = { width: encodedImageWidth, height: encodedImageDataStartingAt }
                    var ctx = canvasWithEncodedImage.getContext("2d");
                    var padding = 10;
                    ctx.imageSmoothingEnabled = false;
                    ctx.oImageSmoothingEnabled = false;
                    ctx.webkitImageSmoothingEnabled = false;
                    ctx.msImageSmoothingEnabled = false;
                    ctx.fillStyle = 'rgb(2, 32, 132)';
                    ctx.fillRect(0, 0, encodedImageWidth, encodedImageDataStartingAt);
                    ctx.strokeStyle = 'rgb(255, 255, 255)';
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
                    ctx.fillStyle = 'rgb(255, 255, 255)';
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
                    ctx.fillStyle = 'rgb(255, 255, 255)';
                    ctx.font = "15px Courier New";
                    ctx.fillText("DO NOT MODIFY", 20, 30);
                    ctx.fillText("DO NOT COMPRESS", blueprintImage.width - 155, 30);
                    ctx.fillText("DO NOT MODIFY", 20, blueprintImage.height - (padding * 2.3));
                    img.src = imgData;
                    img.onload = function () {
                        encodeJsonInCanvas(json, ctx);
                    };
                });
            }
        }
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
        }
    },
    methods: {
        duplicateSelected: function () {
            app.selection.duplicate()
        },
        deselect: function () {
            app.selection.deselectFromButton()
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
});

Vue.component("modal", {
    //mode: loading, image
    //title:
    //body
    //img
    props: ['title', 'source'],
    template: `
    <transition name="modal">
    <div class="modal-mask">
        <div class="modal-wrapper">
            <div class="modal-container">
                <div class="modal-header">
                    <slot name="header">
                        {{title}}
                    </slot>
                </div>
                <div class="modal-body">
                    <slot name="body">
                        <img :src="source" class="saveImg" id="saveImg">
                    </slot>
                </div>
                <div class="modal-footer">
                    <slot name="footer">
                        default footer
                        <button class="modal-default-button" @click="$emit('close')">
                            OK
                        </button>
                    </slot>
                </div>
            </div>
        </div>
    </div>
</transition>
  `
});

var renderer, miniAxisRenderer, scene, miniAxisScene, camera, miniAxisCamera;
var controls, transformControls;
var matLine, matLineBasic;
var matLineDrawn;

var paths = [];

//var selection = app.selection;
var raycaster;
var raycastObject;

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
        this.render.start(mouse.tx, mouse.ty, 0, true, app.lineColor, app.lineWidth, app.mirror);
    },
    move: function () {
        //Add line elements
        this.render.update(mouse.tx, mouse.ty, 0, true);
    },
    end: function () {
        //Close and add line to scene
        this.render.end();
        // this.linepositions.push(vNow.x, vNow.y, vNow.z);
        // this.renderLine(this.linepositions, app.lineColor, app.lineWidth, app.mirror, false);
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
                lineWidth: lineWidth / 1500, //kind of eyballing it
                sizeAttenuation: 0,
                color: new THREE.Color(lineColor),
                side: THREE.DoubleSide,
            });
            var mesh = new THREE.Mesh(this.line.geometry, material);
            mesh.raycast = MeshLineRaycast;
            scene.add(mesh);

            mesh.userData.color = lineColor;
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
        fromVertices(vertices, lineColor, lineWidth, mirrorOn) {
            line.render.start(vertices[0].x, vertices[0].y, vertices[0].z, false, lineColor, lineWidth, mirrorOn);
            for (var i = 1; i < vertices.length; i++) {
                line.render.update(vertices[i].x, vertices[i].y, vertices[i].z, false)
            }
            line.render.end();
            console.log(scene);
        },
    },
    renderLine: function (positions, lineColor, lineWidth, mirrorOn, returnLineBool) {
        var matLineDrawn = new LineMaterial({
            color: new THREE.Color(lineColor),
            linewidth: lineWidth,
            vertexColors: false,
            wireframe: false,
            side: THREE.DoubleSide,
            depthWrite: true
        });
        materials.push(matLineDrawn); //this is needed to set the resolution in the renderer properly
        var geometry = new LineGeometry();
        var positions = this.rejectPalm(positions);
        geometry.setPositions(positions);
        geometry.userData = positions;
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
        var lposition = l.getWorldPosition(lposition);
        var lquaternion = l.getWorldQuaternion(lquaternion);
        var lscale = l.getWorldScale(lscale);
        scene.add(l);

        if (returnLineBool == true) {
            return l;
        }
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
        raycaster.params.Line.threshold = 0.001;
        raycaster.layers.set(1);
        paths.push([mouse.cx, mouse.cy]);
    },
    move: function () {
        paths[paths.length - 1].push([mouse.cx, mouse.cy]);
        //This is to render line transparency,
        //we are redrawing the line every frame
        this.redrawLine('rgba(255,255,255, 0.15)');

        try {
            raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
            var object = raycaster.intersectObjects(scene.children)[0].object;
            if (checkIfHelperObject(object)) {
            } else {
                //blueprint.removeFromBlueprint(object);
                scene.remove(object);
                mirror.eraseMirrorOf(object);
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

app.selection = {
    array: [],
    selection: [],
    selected: [],
    somethingSelected: false,
    helper: undefined,
    group: undefined,
    transforming: false,
    raycaster: new THREE.Raycaster(),
    start: function () {
        if (!this.transforming) {
            paths.push([mouse.cx, mouse.cy]);
            this.raycaster = new THREE.Raycaster();
            this.raycaster.params.Line.threshold = 0.01;
            this.raycaster.layers.set(1);
            try {
                this.raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
                //scene.add(new THREE.ArrowHelper(this.raycaster.ray.direction, this.raycaster.ray.origin, 100, Math.random() * 0xffffff));
                var intersectedObject = this.raycaster.intersectObjects(scene.children)[0].object;
                if (intersectedObject != undefined && this.selection.indexOf(intersectedObject) < 0 && this.selected.indexOf(intersectedObject) < 0) {
                    this.selection.push(intersectedObject);
                    this.toggleSelectionColor(intersectedObject, true);
                }
            } catch (err) {
                //console.log(err);
            }
        }
    },
    move: function () {
        if (!this.transforming) {
            paths[paths.length - 1].push([mouse.cx, mouse.cy]);
            //This is to render line transparency,
            //we are redrawing the line every frame
            this.redrawLine('rgba(254, 207, 18, 0.25)');
            try {
                this.raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
                //scene.add(new THREE.ArrowHelper( this.raycaster.ray.direction, this.raycaster.ray.origin, 100, Math.random() * 0xffffff ));
                var intersectedObject = this.raycaster.intersectObjects(scene.children)[0].object;
                if (intersectedObject != undefined && this.selection.indexOf(intersectedObject) < 0 && this.selected.indexOf(intersectedObject) < 0) {
                    this.selection.push(intersectedObject);
                    this.toggleSelectionColor(intersectedObject, true);
                }
            } catch (err) {
                //console.log(err);
            }
        }
    },
    end: function () {
        if (!this.transforming) {
            context.closePath();
            context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            paths = [];
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
            this.selected.forEach(object => {
                var duplicate = object.clone();
                var duplicateMaterial = object.material.clone();
                duplicate.material = duplicateMaterial;
                duplicateArray.push(duplicate);
                mirror.object(duplicate, duplicate.userData.mirrorAxis);
            })
            //deselect selected group
            this.deselect();
            this.selected = duplicateArray;
            console.log(this.selected)
            // //Add all the selected elements to the temporary groups
            this.selected.forEach(element => {
                this.toggleSelectionColor(element, true)
            })
            this.addTransformControls(this.selected);
            this.group.position.set(
                sourcePosition.x + 0.1,
                sourcePosition.y,
                sourcePosition.z
            )
            this.helper.update();
            mirror.updateMirrorOf(this.group);
        }
        //it's a single objet
        else if (this.selected.length == 1) {
            var duplicate = this.selected[0].clone();
            var originalPosition = duplicate.position;
            var duplicateMaterial = duplicate.material.clone();
            duplicate.material = duplicateMaterial;
            duplicate.position.set(
                originalPosition.x + 0.1,
                originalPosition.y,
                originalPosition.z
            )
            scene.add(duplicate);
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
        if (selection.length == 1) {
            this.helper = new THREE.BoxHelper(selection[0], 0xfecf12);
            scene.add(this.helper);
            transformControls = new TransformControls(camera, drawingCanvas);
            transformControls.attach(selection[0]);
            this.selected.push(selection[0])
            this.helper.update();
        } else {
            this.group = new THREE.Group();
            scene.add(this.group);
            this.helper = new THREE.BoxHelper(this.group, 0xfecf12);
            scene.add(this.helper);
            //calculate where is the center for the selected objects so we can set the center of the group before we attach objects to it;
            var center = new THREE.Vector3();
            selection.forEach(obj => {
                center.add(obj.position);
            })
            center.divideScalar(selection.length);
            this.group.position.set(center.x, center.y, center.z);
            //Clone all the selected elements to the temporary groups
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
        transformControls.addEventListener("mouseDown", function () {
            app.selection.transforming = true;
        });
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
            });
        });
        transformControls.addEventListener("mouseUp", function () {
            console.log(app.selection.transforming);
            app.selection.transforming = false;
            console.log(app.selection.transforming);
        });
        scene.add(transformControls);
        this.selection = [];
        console.log(scene);
    },
    deselect: function () {
        transformControls.detach();
        scene.remove(transformControls);
        scene.remove(this.helper);

        switch (true) {
            case (this.selected.length == 0):
                console.log(this.selected.length)
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
        console.log(object);
        if (bool) {
            object.material.color = new THREE.Color(0xfecf12);
        } else {
            object.material.color = new THREE.Color(object.userData.color);
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
}

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
        var json = JSON.parse(json);
        json.forEach(importedLine => {
            var l = line.renderLine(
                importedLine.g,
                "rgb(" + importedLine.c.r + "," + importedLine.c.g + "," + importedLine.c.b + ")",
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
        })
    }
}

//Improvements to the save and restore:
//the image should maintain the correct aspect ratio
//It should be possible to discard the mirrored elements, the renderLine function _should_ take care of them
//And if that's the case, UUID could just be removed. We'll generate new ones
//Color could be vastly simplified and genericized (so it's eventually theme independent)

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
    miniAxisRenderer.setClearColor(0x000000, 0.4);
    miniAxisRenderer.setSize(250, 250);
    miniAxis.appendChild(miniAxisRenderer.domElement);

    scene = new THREE.Scene();
    //Set the background based on the css variable;
    var bgCol = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').match(/\d+/g);
    scene.background = new THREE.Color(bgCol[0] / 255, bgCol[1] / 255, bgCol[2] / 255);
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
    //transformControls = new TransformControls(camera, drawingCanvas);

    // var g = new THREE.Geometry();
    // var l = new MeshLine();
    // g.vertices.push(new THREE.Vector3(0, 0, 0));
    // g.vertices.push(new THREE.Vector3(1, 1, 1));
    // l.setGeometry(g);
    // var material = new MeshLineMaterial({
    //     lineWidth: 0.1,
    //     sizeAttenuation: 0,
    //     color: 0xFFFFFF,
    //     side: THREE.DoubleSide,
    //     wireframe: false
    // });
    // var mesh = new THREE.Mesh(l.geometry, material);
    // mesh.raycast = MeshLineRaycast;
    // scene.add(mesh);
    // mesh.layers.set(1);
    // mesh.position.set(
    //     mesh.geometry.boundingSphere.center.x,
    //     mesh.geometry.boundingSphere.center.y,
    //     mesh.geometry.boundingSphere.center.z
    // );
    // g.center();
    // mesh.geometry.setGeometry(g);
    // g.verticesNeedsUpdate = true;
    // g.needsUpdate = true;
    // console.log(mesh)

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
    drawingCanvas.width = window.innerWidth;
    drawingCanvas.height = window.innerHeight;

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
    miniAxisRenderer.render(miniAxisScene, miniAxisCamera);
}

function checkIfHelperObject(object) {
    if (object.type === "AxesHelper" || object.type === "GridHelper" || object.type === "Object3D") {
        return true
    } else { return false }
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

document.getElementById("Load").addEventListener("click", importFrom.imageWithEncodedFile);

// document.getElementById("Export").addEventListener("click", exportTo.gltf);
// document.getElementById("makeGif").addEventListener("click", exportTo.gif);
