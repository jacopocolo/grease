import * as THREE from "../build/three.module.js";
// import { OrbitControls } from "../build/OrbitControls.js";
import CameraControls from "../build/CameraControls.js";
import { OrbitControls } from "../build/OrbitControls.js";
import { TransformControls } from "../build/TransformControls.js";
import {
    MeshLine,
    MeshLineRaycast,
    MeshLineMaterial
} from '../build/meshline.js';
import { GLTFExporter } from '../build/GLTFExporter.js';
import Vue from '../build/vue.esm.browser.js';

var app = new Vue({
    el: '#app',
    data: {
        selectedTool: 'draw', //Options are 'draw', 'erase', 'select'
        selectedTransformation: 'translate', //Options are "translate", "rotate" and "scale"
        selectedCameraControl: 'rotate',
        isAGroupSelected: false, //Transform tools must be restricted if true
        selectedColor: 'lightest', //buffer from the selector so it can be genericized
        lineColor: getComputedStyle(document.documentElement).getPropertyValue('--line-color-lightest'), //Rgb value
        lineWidth: 3, //Default 3
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
        selectedCameraControl: function (val) {
            switch (val) {
                case "rotate":
                    directControls.mouseButtons.wheel = CameraControls.ACTION.ROTATE;
                    directControls.mouseButtons.right = CameraControls.ACTION.ROTATE;
                    directControls.touches.two = CameraControls.ACTION.TOUCH_ROTATE;
                    break;
                case "pan":
                    directControls.mouseButtons.wheel = CameraControls.ACTION.TRUCK;
                    directControls.mouseButtons.right = CameraControls.ACTION.TRUCK;
                    directControls.touches.two = CameraControls.ACTION.TOUCH_TRUCK;
                    break;
                case "zoom":
                    directControls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
                    directControls.mouseButtons.right = CameraControls.ACTION.ZOOM;
                    directControls.touches.two = CameraControls.ACTION.TOUCH_ZOOM;
                    break;
                default:
                    directControls.mouseButtons.wheel = CameraControls.ACTION.ROTATE;
                    directControls.touches.two = CameraControls.ACTION.TOUCH_ROTATE;
            }
        },
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
            directControls.setLookAt(0, 0, 10, 0, 0, 0, true)
            directControls.zoomTo(160, true)
            directControls.enabled = true;
            setTimeout(() => { directControls.dampingFactor = 10 }, 100)
        },
        toggleUi: function () {
            app.ui.show = !app.ui.show;
        },
        //MOUSE HANDLERS
        onTapStart: function (event) {

            if (event.touches && event.touches.length > 1 || app.selection.selected.length > 0 || event.which == 3) { return }

            mouse.updateCoordinates(event);

            switch (this.selectedTool) {
                case "draw":
                    line.start();
                    break;
                case "erase":
                    eraser.start();
                    break;
                case "select":
                    app.selection.start();
                    break;
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
        }
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
                               <a download="video.mp4" :href="helptext">Link</a>
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

var renderer, miniAxisRenderer, scene, miniAxisScene, pickingScene, camera, miniAxisCamera, controls, directControls, transformControls, clock, insetWidth, insetHeight;
var paths = []; //For canvas rendering of selection and erase
var drawingCanvas = document.getElementById("drawingCanvas");
var context = drawingCanvas.getContext("2d");
drawingCanvas.width = window.innerWidth;
drawingCanvas.height = window.innerHeight;
var main = document.getElementById("main");
var miniAxis = document.getElementById("miniAxis");
CameraControls.install({ THREE: THREE });

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
            mesh.raycast = MeshLineRaycast;
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
    },
    updateDrawingPlane: function () {
        this.drawingPlane.rotation.copy(camera.rotation);
        //camera zoom has a minimum of 450 and a maximum of infinity
    }
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
        clone.raycast = MeshLineRaycast;
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

//what do I want to do
//I want to have an area selection that has startX, startY, endX, endY
//I want iterate through all objects and unproject their coordinates
//Check if any one point of the bounding box is inside of the area (minimize calculations)
//If any one point of the bounding box is inside the area, iterate through all (?) the unprojected vertices and if one is inside of the area, add to the selected group
//Done

class vertexSelection {
    constructor() {
        this.start = new THREE.Vector2();
        this.end = new THREE.Vector2();
        this.cssStart = new THREE.Vector2();
        this.cssEnd = new THREE.Vector2();
    }
    pointInRect(x, y, z1, z2, z3, z4) {
        let x1 = Math.min(z1, z3);
        let x2 = Math.max(z1, z3);
        let y1 = Math.min(z2, z4);
        let y2 = Math.max(z2, z4);
        if ((x1 <= x) && (x <= x2) && (y1 <= y) && (y <= y2)) {
            return true;
        } else {
            return false;
        };
    }
    getObjectBoundingBoxPoints(object) {

        let bb = object.geometry.boundingBox

        var points = [
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3()
        ];

        points[0].set(bb.min.x, bb.min.y, bb.min.z); // 000
        points[1].set(bb.min.x, bb.min.y, bb.max.z); // 001
        points[2].set(bb.min.x, bb.max.y, bb.min.z); // 010
        points[3].set(bb.min.x, bb.max.y, bb.max.z); // 011
        points[4].set(bb.max.x, bb.min.y, bb.min.z); // 100
        points[5].set(bb.max.x, bb.min.y, bb.max.z); // 101
        points[6].set(bb.max.x, bb.max.y, bb.min.z); // 110
        points[7].set(bb.max.x, bb.max.y, bb.max.z); // 111
        points[8].set(object.geometry.boundingSphere.center.x, object.geometry.boundingSphere.center.y, object.geometry.boundingSphere.center.z) //does it make sense to add this?

        points.forEach(point => {
            point.applyMatrix4(object.matrix);
            point.project(camera);

            //DEBUG
            // let unprojectedPoint = point.clone();
            // unprojectedPoint.unproject(camera);
            // const geometry = new THREE.SphereGeometry(0.01, 4, 4);
            // const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            // const sphere = new THREE.Mesh(geometry, material);
            // scene.add(sphere);
            // sphere.position.set(unprojectedPoint.x, unprojectedPoint.y, unprojectedPoint.z)
        })

        return points
    }
    select() {

        let selectedObjects = new Array();

        scene.children.forEach(object => {

            if (object.layers.mask == 2) {
                //get the projected bounding points of the rectangle
                let boundingBoxPoints = this.getObjectBoundingBoxPoints(object);

                for (var j = boundingBoxPoints.length; j--;) {

                    //check if any of the points is part of the selection 
                    let point = boundingBoxPoints[j]
                    if (this.pointInRect(point.x, point.y, this.start.x, this.start.y, this.end.x, this.end.y)) {

                        //If even one point is inside of the selection, it's worth checking for all the vertices, otherwise not
                        for (var k = object.geometry.vertices.length; k--;) {

                            let p = new THREE.Vector3(
                                object.geometry.vertices[k].x,
                                object.geometry.vertices[k].y,
                                object.geometry.vertices[k].z
                            );
                            p.applyMatrix4(object.matrix);
                            p.project(camera);

                            if (this.pointInRect(p.x, p.y, this.start.x, this.start.y, this.end.x, this.end.y)) {

                                selectedObjects.push(object);
                                return
                            }

                        }
                    }
                }

            }

        })

        return selectedObjects;

    }
}

app.selection = {
    array: [],
    selection: [],
    selected: [],
    selector: new vertexSelection(),
    helper: undefined,
    group: undefined,
    transforming: function () {
        if (transformControls.userData.hover) {
            return transformControls.userData.hover
        } else { return false }
    },
    color: getComputedStyle(document.documentElement).getPropertyValue('--accent-color'),
    start: function () {
        if (this.transforming() === false) {

            this.deselect()

            let raycaster = new THREE.Raycaster();
            raycaster.params.Line.threshold = 0.001;
            raycaster.layers.set(1);
            raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
            try {
                var intersectedObject = raycaster.intersectObjects(scene.children)[0].object;
                this.selection.push(intersectedObject)
            } catch (err) {
                //expected error if nothing is found
            }

            this.selector.start.x = mouse.tx;
            this.selector.start.y = mouse.ty;
            this.selector.cssStart.x = mouse.cx;
            this.selector.cssStart.y = mouse.cy;

        }
    },
    move: function () {
        if (this.transforming() === false && this.selected.length == 0) {

            context.clearRect(0, 0, window.innerWidth, window.innerHeight)
            context.beginPath();
            context.rect(this.selector.cssStart.x, this.selector.cssStart.y, mouse.cx - this.selector.cssStart.x, mouse.cy - this.selector.cssStart.y);
            context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-color-selected');
            context.lineWidth = 0.7;
            context.setLineDash([4, 4]);
            context.stroke();

        }
    },
    end: function () {

        context.clearRect(0, 0, window.innerWidth, window.innerHeight)
        this.selector.end.x = mouse.tx;
        this.selector.end.y = mouse.ty;
        let objectsInRect = this.selector.select();
        objectsInRect.forEach(object => {
            this.selection.push(object);
        })

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
                var duplicateMaterial = object.material.clone();
                duplicate.material = duplicateMaterial;
                duplicateArray.push(duplicate);
                scene.add(duplicate);
                mirror.object(duplicate, duplicate.userData.mirrorAxis);
            })
            //deselect selected group
            this.deselect();
            app.selection.selection = duplicateArray;
            app.selection.selection.forEach(element => {
                this.toggleSelectionColor(element, true)
            })
            this.select(app.selection.selection);
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
            this.toggleSelectionColor(selection[0], true);
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
                this.toggleSelectionColor(obj, true);
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

let importFrom = {
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
    mp4: {
        exporting: false,
        currentLength: 0,
        length: 10,
        images: [],
        worker: new Worker("../build/ffmpeg-worker-mp4.js"),
        pad: function (n, insetWidth, z) {
            z = z || "0";
            n = n + "";
            return n.length >= insetWidth ? n : new Array(insetWidth - n.length + 1).join(z) + n;
        },
        addFrame: function () {

            if (this.currentLength == 0) {
                app.modal.show = true;
                app.modal.mode = 'loader';
                app.modal.title = "Making you a movie";
                app.modal.helptext = "This might take a moment, please be patient";
            } else {
                app.modal.helptext = "Frame " + this.currentLength + " out of " + this.length;
            }

            const img = new Image(),
                mimeType = "image/jpeg";

            const imgString = renderer.domElement.toDataURL(mimeType, 1);

            const data = this.convertDataURIToBinary(imgString);

            this.images.push({
                name: `img${this.pad(this.images.length, 3)}.jpeg`,
                data
            });
        },
        convertDataURIToBinary: function (dataURI) {
            var base64 = dataURI.replace(/^data[^,]+,/, "");
            var raw = window.atob(base64);
            var rawLength = raw.length;

            var array = new Uint8Array(new ArrayBuffer(rawLength));
            for (let i = 0; i < rawLength; i++) {
                array[i] = raw.charCodeAt(i);
            }
            return array;
        },
        finalizeVideo: function () {
            app.modal.helptext = "Generating your video";

            this.worker.onmessage = function (e) {
                var messages;
                var msg = e.data;
                switch (msg.type) {
                    case "stdout":
                    case "stderr":
                        messages += msg.data + "\n";
                        break;
                    case "exit":
                        console.log("Process exited with code " + msg.data);
                        //worker.terminate();
                        break;
                    case "done":
                        const blob = new Blob([msg.data.MEMFS[0].data], {
                            type: "video/mp4"
                        });
                        app.exportTo.mp4.done(blob);
                        break;
                }
                console.log(messages);
                //app.modal.helptext = messages
            };
            this.worker.postMessage({
                type: "run",
                TOTAL_MEMORY: 468435456,
                arguments: [
                    "-r",
                    "20",
                    "-stream_loop", //loop twice
                    "1",            //loop twice
                    "-i",
                    "img%03d.jpeg",
                    "-c:v",
                    "libx264",
                    "-crf",
                    "1",
                    "-vf",
                    "scale=" + 1024 + ":" + 1024 + "",
                    "-pix_fmt",
                    "yuv420p",
                    "-vb",
                    "20M",
                    "out.mp4"
                ],
                MEMFS: this.images
            });
        },
        done: function (output) {
            const url = webkitURL.createObjectURL(output);
            console.log("Completed video")
            app.modal.title = "Here’s your video";
            app.modal.helptext = url;
            app.modal.mode = "modal";
            console.log("done");
            app.autoRotate = false;
        }
    },
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
    miniAxisRenderer.setClearColor(new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--ui-bg-color')), 0);
    miniAxisRenderer.setSize(150, 150);
    miniAxis.appendChild(miniAxisRenderer.domElement);

    scene = new THREE.Scene();
    //Set the background based on the css variable;
    var bgCol = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');
    scene.background = new THREE.Color(bgCol);
    scene.fog = new THREE.Fog(bgCol, 9, 13);
    miniAxisScene = new THREE.Scene();

    var axesHelper = new THREE.AxesHelper();
    axesHelper.applyMatrix4(new THREE.Matrix4().makeScale(5, 5, 5));
    axesHelper.layers.set(0);
    axesHelper.material.fog = false;
    scene.add(axesHelper);

    var axesHelperFlipped = new THREE.AxesHelper();
    axesHelperFlipped.applyMatrix4(new THREE.Matrix4().makeScale(-5, -5, -5));
    axesHelperFlipped.layers.set(0);
    axesHelperFlipped.material.fog = false;
    scene.add(axesHelperFlipped);

    drawAxisHelperControls();

    var size = 1;
    var divisions = 1;
    var gridHelper = new THREE.GridHelper(size, divisions);
    gridHelper.applyMatrix4(new THREE.Matrix4().makeScale(5, 5, 5));
    gridHelper.layers.set(0);
    gridHelper.material.fog = false;
    scene.add(gridHelper);

    camera = new THREE.OrthographicCamera(
        window.innerWidth / -2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        window.innerHeight / -2,
        0,
        20
    );
    camera.layers.enable(0); // enabled by default
    camera.layers.enable(1);
    camera.zoom = 160;
    camera.position.set(0, 0, 10);

    clock = new THREE.Clock();

    directControls = new CameraControls(camera, drawingCanvas);
    directControls.dampingFactor = 10
    directControls.mouseButtons.left = CameraControls.ACTION.NONE
    directControls.mouseButtons.right = CameraControls.ACTION.ROTATE
    directControls.mouseButtons.wheel = CameraControls.ACTION.ROTATE
    directControls.touches.one = CameraControls.ACTION.NONE
    directControls.touches.two = CameraControls.ACTION.TOUCH_ROTATE_ZOOM
    directControls.touches.three = CameraControls.ACTION.TOUCH_DOLLY_TRUCK

    controls = new OrbitControls(camera, miniAxisRenderer.domElement);
    controls.rotateSpeed = 0.4;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.saveState();

    var geometry = new THREE.SphereBufferGeometry(0.025, 32, 32);
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
        if (app.experimental) { line.drawingPlane.position.set(target.x, target.y, target.z) }
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

    renderer.render(scene, camera);
    miniAxisRenderer.render(miniAxisScene, miniAxisCamera);
}

function animate() {
    const delta = clock.getDelta();
    updateminiAxisScene();

    if (app.experimental) {
        line.updateDrawingPlane();
    }

    let hasdirectControlsUpdated
    if (directControls.enabled == true) {
        hasdirectControlsUpdated = directControls.update(delta);
    }

    requestAnimationFrame(animate);
    if (transformControls) {
        transformControls.mode = app.selectedTransformation;
    }

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    miniAxisRenderer.setViewport(0, 0, 150, 150);
    renderer.render(scene, camera);
    miniAxisRenderer.render(miniAxisScene, miniAxisCamera);

    if (app.exportTo.mp4.exporting) {
        camera.layers.disable(0)

        if (app.exportTo.mp4.currentLength < app.exportTo.mp4.length) {
            directControls.rotate(6 * THREE.MathUtils.DEG2RAD, 0, true)
            app.exportTo.mp4.addFrame();
            app.exportTo.mp4.currentLength++;
        } else {
            if (app.exportTo.mp4.currentLength == app.exportTo.mp4.length) {
                camera.layers.enable(0)
                app.exportTo.mp4.finalizeVideo();
                app.exportTo.mp4.currentLength = 0;
                app.exportTo.mp4.exporting = false;
            }
        }

    }
}

//MINI CAMERA
function updateminiAxisScene() {
    miniAxisScene.quaternion.copy(camera.quaternion).inverse()
}
function drawAxisHelperControls() {

    let size = 0.9;
    let distance = size / 2;

    var front = new THREE.TextureLoader().load("../img/sides/front.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: front, color: 0x0099ff });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, distance)
    plane.name = "z"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var back = new THREE.TextureLoader().load("../img/sides/back.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: back, color: 0x0099ff });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, -distance)
    plane.rotation.y = Math.PI;
    plane.name = "-z"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var top = new THREE.TextureLoader().load("../img/sides/top.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: top, color: 0x99ff00 });
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
    var material = new THREE.MeshBasicMaterial({ map: bottom, color: 0x99ff00 });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, -distance, 0)
    plane.rotation.x = Math.PI / 2;
    plane.name = "-y"
    plane.layers.set(1);
    miniAxisScene.add(plane);

    var right = new THREE.TextureLoader().load("../img/sides/right.png");
    var geometry = new THREE.PlaneGeometry(size, size, size);
    var material = new THREE.MeshBasicMaterial({ map: right, color: 0xff6600 });
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
    var material = new THREE.MeshBasicMaterial({ map: left, color: 0xff6600 });
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

    miniAxisRenderer.domElement.addEventListener("mousemove", (e) => {
        if (directControls.enabled == false) {
            console.log(e.movementX, e.movementY);
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

        let target = new THREE.Vector3();
        target = directControls.getTarget(target);
        var x = target.x;
        var y = target.y;
        var z = target.z;

        switch (object.name) {
            case 'z':
                directControls.dampingFactor = 0.5
                directControls.enabled = false;
                directControls.setLookAt(target.x, target.y, target.z + 10, target.x, target.y, target.z, true)
                directControls.enabled = true;
                setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                break;
            case 'x':
                directControls.dampingFactor = 0.5
                directControls.enabled = false;
                directControls.setLookAt(target.x + 10, target.y, target.z, target.x, target.y, target.z, true)
                directControls.enabled = true;
                setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                break;
            case 'y':
                directControls.dampingFactor = 0.5
                directControls.enabled = false;
                directControls.setLookAt(target.x, target.y + 10, target.z, target.x, target.y, target.z, true)
                directControls.enabled = true;
                setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                break;
            case '-x':
                directControls.dampingFactor = 0.5
                directControls.enabled = false;
                directControls.setLookAt(target.x - 10, target.y, target.z, target.x, target.y, target.z, true)
                directControls.enabled = true;
                setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                break;
            case '-y':
                directControls.dampingFactor = 0.5
                directControls.enabled = false;
                directControls.setLookAt(target.x, target.y - 10, target.z, target.x, target.y, target.z, true)
                directControls.enabled = true;
                setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                break;
            case '-z':
                directControls.dampingFactor = 0.5
                directControls.enabled = false;
                directControls.setLookAt(target.x, target.y, target.z - 10, target.x, target.y, target.z, true)
                directControls.enabled = true;
                setTimeout(() => { directControls.dampingFactor = 10 }, 100)
                break;
            default:
        }


    }
};