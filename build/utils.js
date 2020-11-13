function makeDragable(dragHandle, dragTarget) {
    let dragObj = null; //object to be moved
    let xOffset = 0; //used to prevent dragged object jumping to mouse location
    let yOffset = 0;

    document.querySelector(dragHandle).addEventListener("mousedown", startDrag, true);
    document.querySelector(dragHandle).addEventListener("touchstart", startDrag, true);

    /*sets offset parameters and starts listening for mouse-move*/
    function startDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        dragObj = document.querySelector(dragTarget);
        dragObj.style.position = "absolute";
        let rect = dragObj.getBoundingClientRect();

        if (e.type == "mousedown") {
            xOffset = e.clientX - rect.left; //clientX and getBoundingClientRect() both use viewable area adjusted when scrolling aka 'viewport'
            yOffset = e.clientY - rect.top;
            window.addEventListener('mousemove', dragObject, true);
        } else if (e.type == "touchstart") {
            xOffset = e.targetTouches[0].pageX - rect.left;
            yOffset = e.targetTouches[0].pageY - rect.top;
            window.addEventListener('touchmove', dragObject, true);
        }
    }

    /*Drag object*/
    function dragObject(e) {
        e.preventDefault();
        e.stopPropagation();

        if (dragObj == null) {
            return; // if there is no object being dragged then do nothing
        } else if (e.type == "mousemove") {
            dragObj.style.left = e.clientX - xOffset + "px"; // adjust location of dragged object so doesn't jump to mouse position
            dragObj.style.top = e.clientY - yOffset + "px";
        } else if (e.type == "touchmove") {
            dragObj.style.left = e.targetTouches[0].pageX - xOffset + "px"; // adjust location of dragged object so doesn't jump to mouse position
            dragObj.style.top = e.targetTouches[0].pageY - yOffset + "px";
        }
    }

    document.addEventListener('touchend', endDragging, true)
    document.addEventListener('mouseup', endDragging, true)

    /*End dragging*/
    function endDragging(e) {
        if (dragObj) {
            //need to make sure we are not dragging out of view?
            dragObj = null;
            window.removeEventListener('mousemove', dragObject, true);
            window.removeEventListener('touchmove', dragObject, true);
        }
    }
}

makeDragable('#miniAxisHandle', '#miniAxis');
// makeDragable('#toolbarHandle', '#toolbar')

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function Rgb(rgb) {
    if (!(this instanceof Rgb)) return new Rgb(rgb);
    var c = rgb.match(/\d+(\.\d+)?%?/g);
    if (c) {
        c = c.map(function (itm) {
            if (itm.indexOf('%') != -1) itm = parseFloat(itm) * 2.55;
            return parseInt(itm);
        });
    }
    this.r = c[0];
    this.g = c[1];
    this.b = c[2];
}

//Update css color variables so they can be used with opacity
let bgColor = Rgb(getComputedStyle(document.documentElement).getPropertyValue('--ui-bg-color'))

document.documentElement.style.setProperty('--ui-bg-color-r', bgColor.r);
document.documentElement.style.setProperty('--ui-bg-color-g', bgColor.g);
document.documentElement.style.setProperty('--ui-bg-color-b', bgColor.b);

console.log(getComputedStyle(document.documentElement).getPropertyValue('--ui-bg-color-r'))

//Should also update the text color if it's too dark
//https://stackoverflow.com/questions/12043187/how-to-check-if-hex-color-is-too-black