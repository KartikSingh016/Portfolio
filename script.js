// Corner readouts: viewport size + local time.
// Scroll reveal is handled natively in CSS (animation-timeline: view()).
const vp = document.getElementById('vp');
const clock = document.getElementById('clock');

function paintViewport() {
  vp.textContent = `${innerWidth} × ${innerHeight}`;
}

function paintClock() {
  const d = new Date();
  clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

paintViewport();
paintClock();
addEventListener('resize', paintViewport);
setInterval(paintClock, 15000);
