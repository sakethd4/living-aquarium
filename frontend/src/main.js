const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const fishies = [];

const MIN_SPEED = 3;
const MAX_SPEED = 10;
const MAX_FORCE = 0.5;       
const SEPARATION_RADIUS = 75;
const WANDER_STRENGTH = 0.5;
const MIN_FELT_DIST = 1 

class Fish {
  constructor (x, y, vx, vy, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
makeFish();


function step() {
  // Phase 1: render fish here.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFish();
  moveFish();
  requestAnimationFrame(step);
}

function drawFish() {
  for (let i = 0; i < 20; i++) {
    ctx.save();
    ctx.translate(fishies[i].x, fishies[i].y);
    ctx.rotate(Math.atan2(fishies[i].vy, fishies[i].vx));
    ctx.beginPath();
    ctx.moveTo(fishies[i].size, 0);
    ctx.lineTo(-fishies[i].size * 0.6, fishies[i].size * 0.5);
    ctx.lineTo(-fishies[i].size * 0.6, -fishies[i].size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function moveFish() {
  for (let i = 0; i < 20; i++) {
    const fish = fishies[i];
    let ax = (Math.random() - 0.5) * WANDER_STRENGTH;
    let ay = (Math.random() - 0.5) * WANDER_STRENGTH;

    const neighbors = getNeighbors(fish, fishies, SEPARATION_RADIUS);
    const sep = seperation(fish, neighbors);
    ax += sep.x;
    ay += sep.y;

    fish.vx += ax;
    fish.vy += ay;

    const speed = Math.hypot(fish.vx, fish.vy);
    if (speed > MAX_SPEED) {
      fish.vx = (fish.vx / speed) * MAX_SPEED;
      fish.vy = (fish.vy / speed) * MAX_SPEED;
    } else if (speed > 0 && speed < MIN_SPEED) {
      fish.vx = (fish.vx / speed) * MIN_SPEED;
      fish.vy = (fish.vy / speed) * MIN_SPEED;
    }

    fish.x += fish.vx;
    fish.y += fish.vy;

    if (fish.x > canvas.width || fish.x < 0) {
      fish.vx *= -1;
      fish.x = Math.max(0, Math.min(canvas.width, fish.x));
    }
    if (fish.y > canvas.height || fish.y < 0) {
      fish.vy *= -1;
      fish.y = Math.max(0, Math.min(canvas.height, fish.y));
    }
  }
}

function makeFish() {
  for (let i = 0; i < 20; i++) {
    fishies.push(new Fish(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.floor(Math.random() * 20) - 10,
      Math.floor(Math.random() * 20) - 10,
      (Math.random() * (11 - 9)) + 9
    ));
  }
}

function getNeighbors(fish, allFish, radius) {
  const neighbors = [];
  for (let i = 0; i < allFish.length; i++) {
    let dist = Math.sqrt((fish.x - allFish[i].x) ** 2 + (fish.y - allFish[i].y) ** 2);
    if (dist <= radius && fish != allFish[i]) {
      neighbors.push(allFish[i]);
    }
  }
  return neighbors;
}

// Contract:
//   in:  fish (has .x, .y, .vx, .vy), neighbors (array of nearby Fish, may be empty)
//   out: { x, y } steering force to add into this frame's acceleration,
//        magnitude already limited to MAX_FORCE
// TODO: implement using the averaged, inverse-distance-weighted steering formula.
function seperation(fish, neighbors) {
  let avgX = 0;
  let avgY = 0;
  for (let i = 0; i < neighbors.length; i++) {
    let dx = fish.x - neighbors[i].x;
    let dy = fish.y - neighbors[i].y;
    let dist = Math.hypot(dx, dy);
    let combinedSize = fish.size + neighbors[i].size;
    let sensingDist = Math.max(MIN_FELT_DIST, dist - combinedSize);
    let pushX = (dx / dist) / sensingDist;
    let pushY = (dy / dist) / sensingDist;
    avgX += pushX;
    avgY += pushY;
  }
  if (neighbors.length == 0) {
    return { x: 0, y: 0 };
  }
  avgX /= neighbors.length;
  avgY /= neighbors.length;
  const avgDist = Math.hypot(avgX, avgY);
  const vx = (avgX / avgDist) * MAX_SPEED;
  const vy = (avgY / avgDist) * MAX_SPEED;
  let steerX = vx - fish.vx;
  let steerY = vy - fish.vy;
  const mag = Math.hypot(steerX, steerY);
  if (mag > MAX_FORCE) {
    steerX = (steerX/mag) * MAX_FORCE;
    steerY = (steerY/mag) * MAX_FORCE;
  }
  
  return { x: steerX, y: steerY };
}

step();
