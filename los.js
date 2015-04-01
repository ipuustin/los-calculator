/*
 *
 * Copyright (c) 2015 Ismo Puustinen <ismo@iki.fi>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

var CELLSIZE = 23;
var HORIZONTAL_CELLS = 25;
var VERTICAL_CELLS = 25;
var GRIDWIDTH = CELLSIZE*HORIZONTAL_CELLS

var losLine1;
var losLine2;

// TODO: remove globals, pass as function arguments
var renderer = new THREE.WebGLRenderer();
// var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
var camera = new THREE.OrthographicCamera(600 / - 2, 600 / 2, 600 / 2, 600 / - 2, 0.1, 10000);
var scene = new THREE.Scene();
var mouseCaster = new THREE.Raycaster();
var container;
var eventBox;
var viewpointCell;

var directionalLight1;

/* the model for selected edges */

/* example: horizontal edge starting from (2,1) and going to (3,1)
   would be [2][1] in horizontalEdges array */

var horizontalEdges = new Array(); // edge indexes
var verticalEdges;

var cells;

var collisionObjects = new Array();

var model = {
    "horizontalEdges" : horizontalEdges,
    "verticalEdges" : verticalEdges,
    "cells" : cells
};

/*

   0   1   2   3   4   5
 0 +---+---+---+---+---+
   |   |   |   |   |   |
   |   |   |   |   |   |
 1 +---+---+---+---+---+
   |   |   |   |   |   |
   |   |   |   |   |   |
 2 +---+---+---+---+---+
   |   |   |   |   |   |
   |   |   |   |   |   |
 3 +---+---+---+---+---+
   |   |   |   |   |   |
   |   |   |   |   |   |
 4 +---+---+---+---+---+
   |   |   |   |   |   |
   |   |   |   |   |   |
 5 +---+---+---+---+---+

*/


var mouseX;
var mouseY;

function initialize() {

    scene.add(camera);
    camera.position.set(0, 0, 700);
    // camera.position.set(0, -200, 200);
    camera.lookAt(scene.position);
    renderer.setSize(1000, 1000);
    renderer.setClearColor(0x111111);

    container = document.getElementById("container");
    container.appendChild(renderer.domElement);

    // draw the grid, GRIDWIDTH wide/tall

    var material = new THREE.LineBasicMaterial({
        color: 0xa0a0a0
    });

    for (var i = 0; i < VERTICAL_CELLS+1; i++) {
        var geometry = new THREE.Geometry();
        geometry.vertices.push(
            new THREE.Vector3(i * CELLSIZE - (GRIDWIDTH/2), -(GRIDWIDTH/2), 25),
            new THREE.Vector3(i * CELLSIZE - (GRIDWIDTH/2), (GRIDWIDTH/2), 25)
        );
        var line = new THREE.Line(geometry, material);
        scene.add(line);
    }

    for (var i = 0; i < HORIZONTAL_CELLS+1; i++) {
        var geometry = new THREE.Geometry();
        geometry.vertices.push(
            new THREE.Vector3(-(GRIDWIDTH/2), i * CELLSIZE - (GRIDWIDTH/2), 25),
            new THREE.Vector3((GRIDWIDTH/2), i * CELLSIZE - (GRIDWIDTH/2), 25)
        );
        var line = new THREE.Line(geometry, material);
        scene.add(line);
    }

    // a box for catching events

    var eventBoxG = new THREE.Geometry();
    eventBoxG.vertices.push(
            new THREE.Vector3(-(GRIDWIDTH/2), -(GRIDWIDTH/2), -10),
            new THREE.Vector3(-(GRIDWIDTH/2), (GRIDWIDTH/2), -10),
            new THREE.Vector3((GRIDWIDTH/2), (GRIDWIDTH/2), -10),
            new THREE.Vector3((GRIDWIDTH/2), -(GRIDWIDTH/2), -10));

    eventBoxG.faces.push(new THREE.Face3(0, 1, 2));
    eventBoxG.faces.push(new THREE.Face3(0, 2, 3));

    var eventBoxMaterial = new THREE.MeshBasicMaterial(
            { color: 0x202020, side:THREE.DoubleSide });
    eventBox = new THREE.Mesh(eventBoxG, eventBoxMaterial);
    scene.add(eventBox);

    // cells for the grid

    cells = new Array(HORIZONTAL_CELLS);
    for (var i = 0; i < HORIZONTAL_CELLS; i++) {
        cells[i] = new Array(VERTICAL_CELLS);
        for (var j = 0; j < VERTICAL_CELLS; j++) {
            var x = i * CELLSIZE - (GRIDWIDTH/2);
            var y = j * CELLSIZE - (GRIDWIDTH/2);

            // the cell background color

            var color = new THREE.Geometry();
            color.dynamic = true;
            color.vertices.push(
                new THREE.Vector3(x, y, 0),
                new THREE.Vector3(x, y+CELLSIZE, 0),
                new THREE.Vector3(x+CELLSIZE, y+CELLSIZE, 0),
                new THREE.Vector3(x+CELLSIZE, y, 0));

            color.faces.push(new THREE.Face3(0, 1, 2));
            color.faces.push(new THREE.Face3(0, 2, 3));

            var colorMaterial = new THREE.MeshBasicMaterial(
                    { color: 0x505050, side:THREE.DoubleSide});
            var colorSquare = new THREE.Mesh(color, colorMaterial);

            cell = { "color" : colorSquare, "viewpoint" : null,
                    "character" : null, "x" : x, "y" : y, "i": i, "j" : j };

            cells[i][j] = cell;

            scene.add(colorSquare);
        }
    }

    // horizontal and vertical edges (walls)

    // note that the array is one longer because there is one more wall than
    // what there are cells in a row (fencepole problem)

    horizontalEdges = new Array(HORIZONTAL_CELLS);
    for (var i = 0; i < HORIZONTAL_CELLS; i++) {
        horizontalEdges[i] = new Array(VERTICAL_CELLS+1);
        for (var j = 0; j < VERTICAL_CELLS+1; j++) {
            var x = i * CELLSIZE - (GRIDWIDTH/2);
            var y = j * CELLSIZE - (GRIDWIDTH/2);
            edge = { "wall" : null, "x" : x, "y" : y, "i" : i, "j" : j };
            horizontalEdges[i][j] = edge;
        }
    }

    verticalEdges = new Array(HORIZONTAL_CELLS+1);
    for (var i = 0; i < HORIZONTAL_CELLS+1; i++) {
        verticalEdges[i] = new Array(VERTICAL_CELLS);
        for (var j = 0; j < VERTICAL_CELLS; j++) {
            var x = i * CELLSIZE - (GRIDWIDTH/2);
            var y = j * CELLSIZE - (GRIDWIDTH/2);
            edge = { "wall" : null, "x" : x, "y" : y, "i" : i, "j" : j };
            verticalEdges[i][j] = edge;
        }
    }

    // set the viewPoint and do the initial LOS calculation

    moveViewpointToCell(cells[12][12]);

    // add some lights

/*
    var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.3);
    scene.add(hemisphereLight);
*/

    directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(1, 0, 1);
    scene.add(directionalLight1);

/*
    var directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(5, 0, 1);
    scene.add(directionalLight2);
*/
    // set up mouse handler

    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mousemove', onMouseMove, false);

    renderer.render(scene, camera);
}

function getCorners(cell) {

    // clone the vertices array

    return cell.color.geometry.vertices.slice(0);
}

function raycastLOS(sourceCorner, targetCorner) {

    // LOS detection happens at z-level 4

    var source = new THREE.Vector3(sourceCorner.x, sourceCorner.y, 4);
    var target = new THREE.Vector3(targetCorner.x, targetCorner.y, 4);
    var direction = target.clone().sub(source).normalize();

    var startDistance = 7; // TODO: this should be in proportion to GRIDWIDTH

    var ray = new THREE.Raycaster(source, direction, startDistance, 10000);

    var intersects = ray.intersectObjects(collisionObjects, true);

    var idx = 0;

    // console.log("ray from ("+source.x+","+source.y+") to ("+target.x+","+target.y+")");

    if (intersects.length >= 1) {
        var distance = source.distanceTo(target);

        // check if the obstacle was before or after this corner

        if (intersects[idx].distance == distance) {
            // console.log("line of sight to the corner ("+intersects[0].distance+":"+distance+")");
            return true;
        }
        else if (intersects[idx].distance < distance) {
            // console.log("no line of sight to the corner ("+intersects[0].distance+":"+distance+")");
            return false;
        }
        else {
            // console.log("line of sight to the corner, cell free ("+intersects[0].distance+":"+distance+")");
            // TODO: check if this is a corner that is causing the ray clipping.
            return true;
        }
    }

    // console.log("no intersection!");
    return true;
}

function checkAlignment(pov, corner1, corner2) {

    if (pov.x == corner1.x && corner1.x == corner2.x)
        return false;
    else if (pov.y == corner1.y && corner1.y == corner2.y)
        return false;

    // console.log("alignment x: "+pov.x+"/"+corner1.x+"/"+corner2.x+", y:"+pov.y+"/"+corner1.y+"/"+corner2.y);
    return true;
}

function walledInTowards(povCorner, targetCorner, index) {
    // see if a vertical and horizontal wall begin/end (depending on which
    // corner this is) here

    var idxX = viewpointCell.i;
    var idxY = viewpointCell.j;

    // indexing starts from bottom left corner (idxX, idxY) and goes clockwise

    switch (index) {
        case 0:
            // bottom left
            var v = verticalEdges[idxX][idxY];
            var h = horizontalEdges[idxX][idxY];
            var hc = horizontalEdges[idxX-1][idxY];
            var vc = verticalEdges[idxX][idxY-1];

            if (v.wall && h.wall) {
                // this is a corner
                if (targetCorner.x < povCorner.x || targetCorner.y < povCorner.y)
                    return true;
            }

            // continuation pieces of wall (long horizontal or vertical)

            if (h.wall && hc.wall) {
                if (targetCorner.y < povCorner.y)
                    return true;
            }

            if (v.wall && vc.wall) {
                if (targetCorner.x < povCorner.x)
                    return true;
            }

            // reverse corners;  *L shape

            if (v.wall && hc.wall) {
                if (targetCorner.x < povCorner.x && targetCorner.y > povCorner.y)
                    return true;
            }

            if (h.wall && vc.wall) {
                if (targetCorner.x > povCorner.x && targetCorner.y < povCorner.y)
                    return true;
            }

            // completely reverse corner

            if (hc.wall && vc.wall) {
                // this is a corner
                if (targetCorner.x < povCorner.x && targetCorner.y < povCorner.y)
                    return true;
            }

            break;

        case 1:
            // top left
            var v = verticalEdges[idxX][idxY];
            var h = horizontalEdges[idxX][idxY+1];
            var vc = verticalEdges[idxX][idxY+1];
            var hc = horizontalEdges[idxX-1][idxY+1];

            if (v.wall && h.wall) {
                // this is a corner
                if (targetCorner.x < povCorner.x || targetCorner.y > povCorner.y)
                    return true;
            }

            // continuation pieces of wall (long horizontal or vertical)

            if (h.wall && hc.wall) {
                if (targetCorner.y >= povCorner.y)
                    return true;
            }

            if (v.wall && vc.wall) {
                if (targetCorner.x <= povCorner.x)
                    return true;
            }

            // reverse corners;  *L shape

            if (v.wall && hc.wall) {
                // this is a corner
                if (targetCorner.x < povCorner.x && targetCorner.y < povCorner.y)
                    return true;
            }

            if (h.wall && vc.wall) {
                // this is a corner
                if (targetCorner.x > povCorner.x && targetCorner.y > povCorner.y)
                    return true;
            }

            // completely reverse corner

            if (hc.wall && vc.wall) {
                if (targetCorner.x < povCorner.x && targetCorner.y > povCorner.y)
                    return true;
            }

            break;

        case 2:
            // top right
            var v = verticalEdges[idxX+1][idxY];
            var h = horizontalEdges[idxX][idxY+1];
            var vc = verticalEdges[idxX+1][idxY+1];
            var hc = horizontalEdges[idxX+1][idxY+1];

            if (v.wall && h.wall) {
                // this is a corner
                if (!(targetCorner.x < povCorner.x && targetCorner.y < povCorner.y))
                    return true;
            }

            // continuation pieces of wall (long horizontal or vertical)

            if (h.wall && hc.wall) {
                if (targetCorner.y > povCorner.y)
                    return true;
            }

            if (v.wall && vc.wall) {
                if (targetCorner.x > povCorner.x)
                    return true;
            }

            // reverse corners;  *L shape

            if (v.wall && hc.wall) {
                // this is a corner
                if (targetCorner.x > povCorner.x && targetCorner.y < povCorner.y)
                    return true;
            }

            if (h.wall && vc.wall) {
                // this is a corner
                if (targetCorner.x < povCorner.x && targetCorner.y > povCorner.y)
                    return true;
            }

            // completely reverse corner

            if (hc.wall && vc.wall) {
                if (targetCorner.x > povCorner.x && targetCorner.y > povCorner.y)
                    return true;
            }

            break;

        case 3:
            // bottom right
            var v = verticalEdges[idxX+1][idxY];
            var h = horizontalEdges[idxX][idxY];
            var vc = verticalEdges[idxX+1][idxY-1];
            var hc = horizontalEdges[idxX+1][idxY];

            if (v.wall && h.wall) {
                // this is a corner
                if (!(targetCorner.x < povCorner.x && targetCorner.y > povCorner.y))
                    return true;
            }

            // continuation pieces of wall (long horizontal or vertical)

            if (h.wall && hc.wall) {
                if (targetCorner.y < povCorner.y)
                    return true;
            }

            if (v.wall && vc.wall) {
                if (targetCorner.x > povCorner.x)
                    return true;
            }

            // reverse corners;  *L shape

            if (v.wall && hc.wall) {
                // this is a corner
                if (targetCorner.x > povCorner.x && targetCorner.y > povCorner.y)
                    return true;
            }

            if (h.wall && vc.wall) {
                // this is a corner
                if (targetCorner.x < povCorner.x && targetCorner.y < povCorner.y)
                    return true;
            }

            // completely reverse corner

            if (hc.wall && vc.wall) {
                if (targetCorner.x > povCorner.x && targetCorner.y < povCorner.y)
                    return true;
            }

            break;
        }

    return false;
}

function idxFromWidth(width) {
    return (width+(GRIDWIDTH/2))/CELLSIZE;
}

function isWall(corner1, corner2) {
    // is there a wall between the two corners?

    if (corner1.x == corner2.x) {
        // vertical edge
        var idxX = idxFromWidth(corner1.x);
        var idxY = corner1.y < corner2.y ? idxFromWidth(corner1.y) : idxFromWidth(corner2.y);

        return verticalEdges[idxX][idxY].wall != null;
    }
    else if (corner1.y == corner2.y) {
        // horizontal edge
        var idxX = corner1.x < corner2.x ? idxFromWidth(corner1.x) : idxFromWidth(corner2.x);
        var idxY = idxFromWidth(corner1.y);

        var d = horizontalEdges[idxX][idxY];
        if (d == null) {
            console.log("impossible!");
            return false;
        }

        return horizontalEdges[idxX][idxY].wall != null;
    }

    console.log("error doing the wall check!");
    return false;
}

function calculateLOSToCell(pov, target)
{
    // rule: if there is one corner in pov cell from which there is LOS to two
    // adjacent corners in the target cell (and the two corners are not
    // aligned vertically or horizontally to the ray), there is LOS to the cell.

    var povCorners = getCorners(pov);
    var targetCorners = getCorners(target);

    for (var i = 0; i < povCorners.length; i++) {
        povCorners[i].cornerIdx = i;
    }

    function distanceFunction(a, b) {
        return targetCorners[0].distanceTo(a) - targetCorners[0].distanceTo(b);
    }

    povCorners.sort(distanceFunction);

    target.povCorner = null;
    target.losCorner1 = null;
    target.losCorner2 = null;

    for (var i = 0; i < povCorners.length; i++) {
        var previousCorner = false;
        var firstCorner = false;

        for (var j = 0; j < targetCorners.length; j++) {

            var success;
            // filter out those corners from calculation which are in a corner
            if (walledInTowards(povCorners[i], targetCorners[j], povCorners[i].cornerIdx)) {
                success = false;
            }
            else if (povCorners[i].y == targetCorners[j].y ||
                    povCorners[i].x == targetCorners[j].x) {
                // same horizontal or vertical line
                success = true;
            }
            else {
                success = raycastLOS(povCorners[i], targetCorners[j]);
            }

            if (success) {
                if (j == 0) {
                    firstCorner = true;
                    previousCorner = true;
                    continue;
                }
                if (previousCorner) {
                    if (checkAlignment(povCorners[i], targetCorners[j-1], targetCorners[j]) &&
                            !isWall(targetCorners[j-1], targetCorners[j])) {
                        target.povCorner = povCorners[i];
                        target.losCorner1 = targetCorners[j-1];
                        target.losCorner2 = targetCorners[j];
                        return true;
                    }
                }
                if (j == 3 && firstCorner) {
                    if (checkAlignment(povCorners[i], targetCorners[0], targetCorners[3]) &&
                            !isWall(targetCorners[0], targetCorners[3])) {
                        target.povCorner = povCorners[i];
                        target.losCorner1 = targetCorners[0];
                        target.losCorner2 = targetCorners[3];
                        return true;
                    }
                }
                previousCorner = true;
            }
            else {
                previousCorner = false;
            }
        }
    }
    return false;
}

function updateCellStatus(cell)
{
    // always LOS to the own cell
    if (cell == viewpointCell)
        return;

    var los = calculateLOSToCell(viewpointCell, cell);

    if (los) {
        // console.log("los to ("+cell.i+","+cell.j+")");
        var colorMaterial = new THREE.MeshBasicMaterial(
                { color: 0x505050, side:THREE.DoubleSide });
        cell.color.material = colorMaterial;

        if (cell.character) {
            var characterMaterial = new THREE.MeshLambertMaterial(
                { color: 0x00bfff, side:THREE.DoubleSide });
            cell.character.material = characterMaterial;
        }
    }
    else {
        // console.log("no los to ("+cell.i+","+cell.j+")");
        var colorMaterial = new THREE.MeshBasicMaterial(
                { color: 0x202020, side:THREE.DoubleSide });
        cell.color.material = colorMaterial;
        if (cell.character) {
            var characterMaterial = new THREE.MeshLambertMaterial(
                { color: 0x0000ff, side:THREE.DoubleSide });
            cell.character.material = characterMaterial;
        }
    }
}

function moveViewpointToCell(cell) {
    var x = cell.x;
    var y = cell.y;

    // remove the viewpoint from the previous cell

    previous = viewpointCell;

    if (previous) {
        scene.remove(previous.viewpoint);
        previous.viewpoint = null;
    }

    var geometry = new THREE.SphereGeometry(10, 10, 10);
    var material = new THREE.MeshLambertMaterial({color: 0xa00000});
    var sphere = new THREE.Mesh(geometry, material);
    sphere.position.x = x + (CELLSIZE/2);
    sphere.position.y = y + (CELLSIZE/2);

    cell.viewpoint = sphere;

    scene.add(sphere);

    viewpointCell = cell;
}

function addCharacterToCell(cell) {
    var x = cell.x;
    var y = cell.y;

    var sphereGeometry = new THREE.SphereGeometry(10, 10, 10);

    sphereGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 8));

    var cubeMaterial = new THREE.MeshLambertMaterial( {color: 0x0000ff, side:THREE.DoubleSide} );

    // help raytracing with internal structure

    var cubeGeometry = new THREE.BoxGeometry(CELLSIZE, CELLSIZE, CELLSIZE);
    var internalGeometry1 = new THREE.BoxGeometry(1, CELLSIZE, CELLSIZE);
    var internalGeometry2 = new THREE.BoxGeometry(CELLSIZE, 1,  CELLSIZE);

    cubeGeometry.merge(sphereGeometry);
    cubeGeometry.merge(internalGeometry1);
    cubeGeometry.merge(internalGeometry2);
    var cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);

    cubeMesh.position.x = x + (CELLSIZE/2);
    cubeMesh.position.y = y + (CELLSIZE/2);

    cell.character = cubeMesh;

    console.log("added character to ("+cell.i+","+cell.j+")");

    collisionObjects.push(cubeMesh);

    scene.add(cubeMesh);
}

function removeCharacterFromCell(cell) {
    scene.remove(cell.character);

    var idx = collisionObjects.indexOf(cell.character);
    collisionObjects.splice(idx, 1);

    cell.character = null;
}

function updateCell(idxX, idxY) {

    var cell = cells[idxX][idxY];

    if (cell == viewpointCell)
        return; // no characters on top of viewpoint

    if (cell.character == null)
        addCharacterToCell(cell);
    else
        removeCharacterFromCell(cell);
}

function addHorizontalWallToEdge(edge) {

    var x = edge.x;
    var y = edge.y;

    var cubeMaterial = new THREE.MeshLambertMaterial({ color: 0x7b3f00, side:THREE.DoubleSide });

    var cubeBaseGeometry = new THREE.BoxGeometry(CELLSIZE, 5, 1);
    var cubeWallGeometry = new THREE.BoxGeometry(CELLSIZE, 1, CELLSIZE);

    cubeBaseGeometry.merge(cubeWallGeometry);
    var cubeMesh = new THREE.Mesh(cubeBaseGeometry, cubeMaterial);

    cubeMesh.position.x = x + (CELLSIZE/2);
    cubeMesh.position.y = y;

    edge.wall = cubeMesh;

    console.log("added horizontal wall to ("+edge.i+","+edge.j+")");

    collisionObjects.push(cubeMesh);

    scene.add(cubeMesh);
}

function addVerticalWallToEdge(edge) {

    var x = edge.x;
    var y = edge.y;

    var cubeMaterial = new THREE.MeshLambertMaterial({ color: 0x7b3f00, side:THREE.DoubleSide });

    var cubeBaseGeometry = new THREE.BoxGeometry(5, CELLSIZE, 1);
    var cubeWallGeometry = new THREE.BoxGeometry(1, CELLSIZE, CELLSIZE);

    cubeBaseGeometry.merge(cubeWallGeometry);
    var cubeMesh = new THREE.Mesh(cubeBaseGeometry, cubeMaterial);

    cubeMesh.position.x = x;
    cubeMesh.position.y = y + (CELLSIZE/2);

    // cubeMesh.updateMatrix();
    // cubeMesh.material.side = THREE.DoubleSided;

    edge.wall = cubeMesh;

    console.log("added vertical wall to ("+edge.i+","+edge.j+")");

    collisionObjects.push(cubeMesh);

    scene.add(cubeMesh);
}

function removeWallFromEdge(edge) {
    scene.remove(edge.wall);

    var idx = collisionObjects.indexOf(edge.wall);
    collisionObjects.splice(idx, 1);

    edge.wall = null;
}

function updateHorizontalWall(idxX, idxY) {

    var edge = horizontalEdges[idxX][idxY];

    if (edge.wall == null) {
        addHorizontalWallToEdge(edge);
    }
    else {
        removeWallFromEdge(edge);
    }
}

function updateVerticalWall(idxX, idxY) {

    var edge = verticalEdges[idxX][idxY];

    if (edge.wall == null) {
        addVerticalWallToEdge(edge);
    }
    else {
        removeWallFromEdge(edge);
    }
}

function updateScene() {

    // see how the click hits our grid

    var mouse3D = new THREE.Vector3((mouseX/1000)*2-1, 1-(mouseY/1000)*2, 0);
    mouseCaster.setFromCamera(mouse3D.clone(), camera);
    var intersects = mouseCaster.intersectObject(eventBox);

    if (intersects.length == 0)
        return;

    var x = Math.round(intersects[0].point.x) + (GRIDWIDTH/2);
    var y = Math.round(intersects[0].point.y) + (GRIDWIDTH/2);

    // see if the click is closer to grid edge or middle

    var distanceFromLeft = x % CELLSIZE;
    var distanceFromTop = y % CELLSIZE;

    if (distanceFromLeft < CELLSIZE/2)
        var distanceX = distanceFromLeft;
    else
        var distanceX = CELLSIZE - distanceFromLeft;

    if (distanceFromTop < CELLSIZE/2)
        var distanceY = distanceFromTop;
    else
        var distanceY = CELLSIZE - distanceFromTop;

    if (distanceX < 5 || distanceY < 5) {

        // grid click

        if (distanceX < distanceY) {
            var idxX = Math.round(x / CELLSIZE);
            var idxY = Math.floor(y / CELLSIZE);
            updateVerticalWall(idxX, idxY);
        }
        else {
            var idxX = Math.floor(x / CELLSIZE);
            var idxY = Math.round(y / CELLSIZE);
            updateHorizontalWall(idxX, idxY);
        }
    }
    else {
        var idxX = Math.floor(x / CELLSIZE);
        var idxY = Math.floor(y / CELLSIZE);
        // console.log("clicked on cell (" + idxX + "," + idxY + ")");

        updateCell(idxX, idxY);
    }

    // render the modified scene before checking for LOS
    renderer.render(scene, camera);

    for (var i = 0; i < cells.length; i++) {
        for (var j = 0; j < cells[i].length; j++) {
            updateCellStatus(cells[i][j]);
        }
    }

    // update line of sight helper lines
    updateLOSLines();

    // render again the tiles that changed color and the new helper lines
    renderer.render(scene, camera);
}

function onMouseDown(e) {
    e.preventDefault();

    mouseX = e.pageX - container.offsetLeft;
    mouseY = e.pageY - container.offsetTop;

    // console.log("" + mouseX + ":" + mouseY);

    updateScene();
}

function addLosLines(cell) {

    var material = new THREE.LineBasicMaterial({
        color: 0xff0000
    });

    var geometry1 = new THREE.Geometry();
    geometry1.vertices.push(
        new THREE.Vector3(cell.povCorner.x, cell.povCorner.y, 30),
        new THREE.Vector3(cell.losCorner1.x, cell.losCorner1.y, 30));
    losLine1 = new THREE.Line(geometry1, material);
    scene.add(losLine1);

    var geometry2 = new THREE.Geometry();
    geometry2.vertices.push(
        new THREE.Vector3(cell.povCorner.x, cell.povCorner.y, 30),
        new THREE.Vector3(cell.losCorner2.x, cell.losCorner2.y, 30));
    losLine2 = new THREE.Line(geometry2, material);
    scene.add(losLine2);
}

function removeLosLines() {
    if (losLine1) {
        scene.remove(losLine1);
        losline1 = null;
    }
    if (losLine2) {
        scene.remove(losLine2);
        losline2 = null;
    }
}

function updateLOSLines() {
    removeLosLines();

    var mouse3D = new THREE.Vector3((mouseX/1000)*2-1, 1-(mouseY/1000)*2, 0);
    mouseCaster.setFromCamera(mouse3D.clone(), camera);
    var intersects = mouseCaster.intersectObject(eventBox);

    if (intersects.length == 0) {
        return;
    }

    var x = Math.round(intersects[0].point.x) + (GRIDWIDTH/2);
    var y = Math.round(intersects[0].point.y) + (GRIDWIDTH/2);

    var idxX = Math.floor(x / CELLSIZE);
    var idxY = Math.floor(y / CELLSIZE);

    var cell = cells[idxX][idxY];

    if (cell.povCorner && cell.losCorner1 && cell.losCorner2) {
        addLosLines(cell);
    }
}

function onMouseMove(e) {
    e.preventDefault();

    mouseX = e.pageX - container.offsetLeft;
    mouseY = e.pageY - container.offsetTop;

    updateLOSLines();

    renderer.render(scene, camera);
}


var degrees = 0.0;
var interval = setInterval(function () { moveLight() }, 200);

function moveLight() {
    degrees += 0.01;

    var x = Math.cos(degrees % (2*Math.PI))
    var y = Math.sin(degrees % (2*Math.PI))

    directionalLight1.position.set(x, y, 1);

    renderer.render(scene, camera);
}