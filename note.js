//this should allow switching between objects, without deselecting
function selectDeselect() {
  raycaster.setFromCamera(new THREE.Vector2(mouse.tx, mouse.ty), camera);
  if (
    raycaster.intersectObjects(scene.children)[0] &&
    raycaster.intersectObjects(scene.children)[0].type != "AxesHelper" &&
    raycaster.intersectObjects(scene.children)[0].type != "GridHelper"
  ) {
    console.log(raycaster.intersectObjects(scene.children)[0]);
    var object = raycaster.intersectObjects(scene.children)[0].object;
    somethingSelected = true;
    selectedObject = object;
    // Add to group

    /*
    selectedGroup = new THREE.Group();
    selectedGroup.add(object);
    scene.add(selectedGroup);
    //dashMaterial(true, object.material);
    transformControls.attach(selectedGroup);
    transformControls.position(
      selectedObject.geometry.boundingSphere.center.x,
      selectedObject.geometry.boundingSphere.center.y,
      selectedObject.geometry.boundingSphere.center.z
    );
    scene.add(transformControls);
    transformControls.mode = "rotate";
    transformControls.space = "local";
    */
    //add an event listener if transformations are happening
    transformControls.addEventListener("mouseDown", function() {
      transforming = true;
    });
    transformControls.addEventListener("mouseUp", function() {
      transforming = false;
    });
  } else {
    //make sure there are no transformations happening
    if (!transforming) {
      transformControls.removeEventListener("mouseDown");
      somethingSelected = false;
      unGrupsinBorrar(selectedGroup.id);
      transformControls.detach();
      //dashMaterial(false, scene.getObjectById(selectedObject.id).material);
      selectedObject = null;
    }
  }
}
