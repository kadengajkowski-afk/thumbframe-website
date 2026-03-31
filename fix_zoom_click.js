const fs = require('fs');
const src = fs.readFileSync('src/Editor.js', 'utf8');

const old = `                  if(activeTool==='zoom'){
                    e.stopPropagation();
                    const rect=canvasRef.current.getBoundingClientRect();
                    // Click position in canvas coordinates (accounting for current zoom+pan)
                    const clickX=(e.clientX-rect.left)/zoom - panOffset.x;
                    const clickY=(e.clientY-rect.top)/zoom - panOffset.y;
                    const centerX=p.preview.w/2;
                    const centerY=p.preview.h/2;
                    if(e.shiftKey||e.altKey){
                      const newZoom=Math.max(0.25,Math.round((zoom-0.5)*10)/10);
                      if(newZoom<=1){setPanOffset({x:0,y:0});}
                      else{
                        // Keep clicked point centered while zooming out
                        const scale=newZoom/zoom;
                        setPanOffset(prev=>({
                          x:(centerX-clickX)*(1-scale)+prev.x*scale,
                          y:(centerY-clickY)*(1-scale)+prev.y*scale,
                        }));
                      }
                      setZoom(newZoom);
                    } else {
                      const newZoom=Math.min(8,Math.round((zoom+0.5)*10)/10);
                      // Pan so the clicked point moves to center of viewport
                      setPanOffset({
                        x:centerX-clickX,
                        y:centerY-clickY,
                      });
                      setZoom(newZoom);
                    }
                    return;
                  }`;

const newCode = `                  if(activeTool==='zoom'){
                    e.stopPropagation();
                    // Same DOM-based coordinate system as the wheel handler:
                    // container = the flex scroll div that wraps the transform wrapper.
                    const canvasRect    = canvasRef.current.getBoundingClientRect();
                    const containerElem = canvasRef.current.parentElement.parentElement;
                    const containerRect = containerElem.getBoundingClientRect();
                    const curZoom       = zoomRef.current;

                    // Mouse position relative to the scroll container
                    const mouseX = e.clientX - containerRect.left;
                    const mouseY = e.clientY - containerRect.top;

                    // Canvas top-left relative to container (already accounts for pan+zoom)
                    const panX = canvasRect.left - containerRect.left;
                    const panY = canvasRect.top  - containerRect.top;

                    // World coordinate (canvas pixel) that sits under the cursor
                    const worldX = (mouseX - panX) / curZoom;
                    const worldY = (mouseY - panY) / curZoom;

                    const newZoom = (e.shiftKey||e.altKey)
                      ? Math.max(0.25, Math.round((curZoom - 0.5) * 10) / 10)
                      : Math.min(8,    Math.round((curZoom + 0.5) * 10) / 10);

                    if(newZoom <= 1){
                      setZoom(newZoom);
                      setPanOffset({x:0,y:0});
                    } else {
                      // New canvas-origin position that keeps worldX/Y pinned under cursor
                      const newPanX = mouseX - worldX * newZoom;
                      const newPanY = mouseY - worldY * newZoom;

                      // Convert to panOffset coord system:
                      //   canvasOriginX = containerW/2 + newZoom*(panOffset.x - canvasW/2)
                      //   => panOffset.x = (newPanX - containerW/2) / newZoom + canvasW/2
                      const cw2 = containerRect.width  / 2;
                      const ch2 = containerRect.height / 2;
                      setZoom(newZoom);
                      setPanOffset({
                        x: (newPanX - cw2) / newZoom + p.preview.w / 2,
                        y: (newPanY - ch2) / newZoom + p.preview.h / 2,
                      });
                    }
                    return;
                  }`;

if (src.includes(old)) {
  const result = src.replace(old, newCode);
  fs.writeFileSync('src/Editor.js', result, 'utf8');
  console.log('REPLACED OK');
} else {
  console.log('NOT FOUND');
  // Show each occurrence of the zoom block for debugging
  const re = /activeTool==='zoom'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    console.log('Found at index', m.index);
    console.log(JSON.stringify(src.slice(m.index, m.index + 300)));
    console.log('---');
  }
}
