
export function drawTestLines() {
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
}

export function drawAxisHelperControls() {
    //x axis
    var geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    var material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    var cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, 1)
    controlScene.add(cube);

    //y axis

    //z axis
}