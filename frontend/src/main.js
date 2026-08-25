const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function step() {
  // Phase 1: render fish here.
  requestAnimationFrame(step);
}

step();
