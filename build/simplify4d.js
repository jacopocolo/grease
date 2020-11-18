/*
 (c) 2013, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/

"use strict";

// to suit your point format, run search/replace for '.x', '.y' and '.z';
// (configurability would draw significant performance overhead)

// square distance between 2 points
function getSquareDistance(p1, p2) {

    var dx = p1.x - p2.x,
        dy = p1.y - p2.y,
        dz = p1.z - p2.z,
        dw = p1.w - p2.w;

    return dx * dx + dy * dy + dz * dz + dw * dw;
}

// square distance from a point to a segment
function getSquareSegmentDistance(p, p1, p2) {

    var x = p1.x,
        y = p1.y,
        z = p1.z,
        w = p1.w,

        dx = p2.x - x,
        dy = p2.y - y,
        dz = p2.z - z,
        dw = p2.w - w;

    if (dx !== 0 || dy !== 0 || dz !== 0 || dw !== 0) {

        var t = (
            (p.x - x) * dx +
            (p.y - y) * dy +
            (p.z - z) * dz +
            (p.w - w) * dw
        ) /
            (dx * dx + dy * dy + dz * dz + dw * dw);

        if (t > 1) {
            x = p2.x;
            y = p2.y;
            z = p2.z;
            w = p2.w;

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
            z += dz * t;
            w += dw * t;
        }
    }

    dx = p.x - x;
    dy = p.y - y;
    dz = p.z - z;
    dw = p.w - w;

    return dx * dx + dy * dy + dz * dz + dw * dw;
}
// the rest of the code doesn't care for the point format

// basic distance-based simplification
function simplifyRadialDistance(points, sqTolerance) {

    var prevPoint = points[0],
        newPoints = [prevPoint],
        point;

    for (var i = 1, len = points.length; i < len; i++) {
        point = points[i];

        if (getSquareDistance(point, prevPoint) > sqTolerance) {
            newPoints.push(point);
            prevPoint = point;
        }
    }

    if (prevPoint !== point) {
        newPoints.push(point);
    }

    return newPoints;
}

// simplification using optimized Douglas-Peucker algorithm with recursion elimination
function simplifyDouglasPeucker(points, sqTolerance) {

    var len = points.length,
        MarkerArray = typeof Uint8Array !== 'undefined' ? Uint8Array : Array,
        markers = new MarkerArray(len),

        first = 0,
        last = len - 1,

        stack = [],
        newPoints = [],

        i, maxSqDist, sqDist, index;

    markers[first] = markers[last] = 1;

    while (last) {

        maxSqDist = 0;

        for (i = first + 1; i < last; i++) {
            sqDist = getSquareSegmentDistance(points[i], points[first], points[last]);

            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }

        if (maxSqDist > sqTolerance) {
            markers[index] = 1;
            stack.push(first, index, index, last);
        }

        last = stack.pop();
        first = stack.pop();
    }

    for (i = 0; i < len; i++) {
        if (markers[i]) {
            newPoints.push(points[i]);
        }
    }

    return newPoints;
}

// both algorithms combined for awesome performance
function simplify4d(points, tolerance, highestQuality) {

    var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

    points = highestQuality ? points : simplifyRadialDistance(points, sqTolerance);
    points = simplifyDouglasPeucker(points, sqTolerance);

    return points;
}

// export as a Node module, an AMD module or a global browser variable
// if (typeof module !== 'undefined') {
//     module.exports = simplify;

// } else if (typeof define === 'function' && define.amd) {
//     define(function () {
//         return simplify;
//     });

// } else {
//     window.simplify = simplify;
// }

export { simplify4d }