# grease
 Experimental tool (still in development) to draw in 3D

---
Draw:
- ~~Draw a tail on mousemove~~
- Change color of the line
    - https://github.com/Simonwep/pickr
- Change width of the line
- Maybe add some smoothing?
  - https://github.com/dulnan/lazy-brush
- Figure out if there's a way to ignore palm fake presses? 
  - Maybe I could discard the first input if the distance between the first input and the second one is massive. No one can draw such long and perfect lines?

Erase:

Select:
-~~ Make lines selectable~~
-~~Make lines DE selectable~~
~~- Allow switching between modes (move, rotation, scale)~~
- ~~Group selection~~
  - Allow all group selection transform (at the moment it's only move)
  - https://threejs.org/examples/misc_boxselection.html
  - https://github.com/mrdoob/three.js/issues/6336#issuecomment-626628464
  - https://github.com/mrdoob/three.js/issues/6336
- Tapping on another object if something is selected should swap selection

Camera controls:
~~- Fine tune speed~~
~~- Snap to axis (x, y, z)~~
- Lock controls
- Reset camera?

Undo redo:
(Basic version)
- Draw a line / Erase a line
  - Store line UUID / Erase object with that UUID
- Erase a line / Restore a line
  - Store object / Add object to scene
- Select a line / Deselect a line
  - Store line UUID /  
- Select a group / Deselect a group
- Deselect a line / Reselect a line
- Deselect a group / Reselect a group
- Move a line / Return line to previous position
- Rotate a line / Return a line to previous rotation
- Scale a line / Scale a line to original scale
- Move a group / Return the group to its previous position
- Duplicate line / Delete line
- Duplicate group / Delete group

Raycaster
- Both eraser and select raycaster should be improved. The raycaster should fire multiple times between each mouseMove. Some elements today are not caught by the movement if the movement is too fast — mouseMove only fires every so often. 

(Maybe)
- Set line width / Return line width to previous position
- 

https://github.com/mrdoob/three.js/pull/7337/files

Save/Load/Export
- https://raw.githubusercontent.com/josdirksen/learning-threejs/master/chapter-08/04-load-save-json-scene.html

Other features
- Export a gif --> https://threesjs-to-gif.glitch.me/
- Might be worth trying an implementation with LineMesh (see: https://jsfiddle.net/jacopocolo/ygj6195e/62/)
- Maybe worth trying to explode into mesh polylines (https://stackoverflow.com/questions/11638883/thickness-of-lines-using-three-linebasicmaterial)
- Local host library and freeze threejs release
- Selectable themes (light, dark, blueprint)
    - Would imply changing the color of the main color line, at least. Could be diffiult but maybe it can be brute-forced
    - It's technically possible to update every single line in the scene with new colors. You can do:

      ````
      function recolorLine(object, r, g, b) {
      var colorArray = [];
      for (var x = 0; x < object.geometry.attributes.instanceColorStart.data.array.length; x++) {
      colorArray.push(r)
      colorArray.push(g)
      colorArray.push(b)
      }
      var updatedColors = new Float32Array(colorArray);
      object.geometry.attributes.instanceColorStart.data.array = updatedColors;
      var updatedColors = new Float32Array(colorArray);
      object.geometry.attributes.instanceColorStart.data.array = updatedColors;
      object.geometry.colorsNeedUpdate = true;
      object.material.needsUpdate = true;
    }
    ````
- ~~Make the miniAxis window draggable~~
  - ~~Make sure the miniAxis window can't be dragged out of the screen~~
  - Make sure you can't drag the miniAxis out of the screen 
- Handle undo properly (can't delete basic objects!)
  - Maybe not needed? Maybe I only need an eraser? Handling undo is a lot of work because it needs to support ALL events.
- Make slow auto rotate that hides UI
- Maybe fill could be possible? 

References
- https://vimeo.com/2864554
- https://github.com/billhsu/cashew
- http://rhondaforever.com/

Fixes:
- ~~Fix rubberbanding if in Webapp mode~~

Difficult stuff:
- Drawing while rotating the camera is possible but it would require to actually render the "guide line" as it's drawn
  - This is non trivial considering that the "guide line" is drawn on a separate canvas and not really in threejs
  - It would also require multitouch to be handled properly so the user could adjust the camera view as they draw
- Saving: what if I generated a very very long UUID, let's say Google Docs sharing link long and used that to store my Json object representing the scene in the DB. The DB doesn't know anything BUT the UUID, the json object match and maybe a preview img so I can render pretty previews.
  - In local storage I only store the UUID and use that to retrievie stuff from the DB
 

Various links:
https://discourse.threejs.org/t/three-infinitegridhelper-anti-aliased/8377

//https://rawgit.com/gkjohnson/three.js/161915d/examples/webgl_lines_fat.html
//https://dustinpfister.github.io/2018/11/07/threejs-line-fat-width/

Original draw: https://jsfiddle.net/w67tzfhx/40/
Original with Line2: https://jsfiddle.net/brLk6aud/1/

https://mattdesl.svbtle.com/drawing-lines-is-hard

https://github.com/spite/THREE.MeshLine
