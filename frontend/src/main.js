const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const fishies = [];

const FISH_COUNT = 1000;
const MIN_SIZE = 6;
const MAX_SIZE = 16;

const MIN_SPEED = 1.5;
const MAX_SPEED = 5;
const MAX_FORCE = 0.4;
const SEPARATION_RADIUS = 75;
const WANDER_STRENGTH = 0.25;
const MIN_FELT_DIST = 1;
const SENSE_RADIUS = SEPARATION_RADIUS / ((MIN_SIZE + MAX_SIZE) / 2);
const ALIGNMENT_RADIUS = 60;
const CELL_SIZE = ALIGNMENT_RADIUS;


class Fish {
  constructor (x, y, vx, vy, size, color, wagPhase) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.color = color;
    this.tailPhase = wagPhase;
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
  for (let i = 0; i < fishies.length; i++) {
    const fish = fishies[i];
    const s = fish.size;
    const wag = Math.sin(fish.tailPhase) * 0.2;

    ctx.save();
    ctx.translate(fish.x, fish.y);
    ctx.rotate(Math.atan2(fish.vy, fish.vx));

    // tail fin (drawn first, so the body overlaps its base) — wags side to side
    ctx.save();
    ctx.translate(-s * 0.6, 0);
    ctx.rotate(wag);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.7, s * 0.4);
    ctx.lineTo(-s * 0.7, -s * 0.4);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.fill();
    ctx.restore();

    // body: rounded, tapering teardrop instead of a flat-edged triangle
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.quadraticCurveTo(s * 0.3, s * 0.6, -s * 0.6, s * 0.25);
    ctx.quadraticCurveTo(-s * 0.9, 0, -s * 0.6, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.6, s, 0);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.fill();

    // eye
    ctx.beginPath();
    ctx.arc(s * 0.45, 0, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "black";
    ctx.fill();

    ctx.restore();
  }
}

function moveFish() {
  const grid = buildGrid(fishies);
  for (let i = 0; i < fishies.length; i++) {
    const fish = fishies[i];
    let ax = (Math.random() - 0.5) * WANDER_STRENGTH;
    let ay = (Math.random() - 0.5) * WANDER_STRENGTH;

    const neighbors = getNeighbors(fish, grid, fish.size * SENSE_RADIUS);
    const sep = seperation(fish, neighbors);
    const school = getNeighbors(fish, grid, ALIGNMENT_RADIUS);
    const align = alignment(fish, school);
    const coh = cohesion(fish, school);
    ax = ax + sep.x + align.x + coh.x;
    ay = ay + sep.y + align.y + coh.y;

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

    fish.tailPhase += speed * 0.1;

    fish.x += fish.vx;
    fish.y += fish.vy;

    const margin = fish.size;
    if (fish.x > canvas.width + margin) fish.x = -margin;
    else if (fish.x < -margin) fish.x = canvas.width + margin;
    if (fish.y > canvas.height + margin) fish.y = -margin;
    else if (fish.y < -margin) fish.y = canvas.height + margin;
  }
}

function makeFish() {
  for (let i = 0; i < FISH_COUNT; i++) {
    fishies.push(new Fish(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.floor(Math.random() * 10) - 5,
      Math.floor(Math.random() * 10) - 5,
      (Math.random() * (MAX_SIZE - MIN_SIZE)) + MIN_SIZE,
      `hsl(${Math.random() * 360}, 70%, 55%)`,
      Math.random() * Math.PI * 2
    ));
  }
}

function getNeighbors(fish, grid, radius) {
  const neighbors = [];
  const cellX = Math.floor(fish.x / CELL_SIZE);
  const cellY = Math.floor(fish.y / CELL_SIZE);
  for (let cx = cellX - 1; cx <= cellX + 1; cx++) {
    for (let cy = cellY - 1; cy <= cellY + 1; cy++) {
      const key = `${cx},${cy}`;
      const fishes = grid.get(key);
      if (fishes == undefined) {
        continue;
      }
      for (let k = 0; k < fishes.length; k++)  {
        let dist = Math.sqrt((fish.x - fishes[k].x) ** 2 + (fish.y - fishes[k].y) ** 2);
        if (dist <= radius && fish != fishes[k]) {
          neighbors.push(fishes[k]);
        }    
      }   
    }
  }
  
  return neighbors;
}

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

function alignment(fish, school) {
  let avgVX = 0;
  let avgVY = 0;
  for (let i = 0; i < school.length; i++) {
    avgVX += school[i].vx;
    avgVY += school[i].vy;
  }
  if (school.length == 0) {
    return { x: 0, y: 0 };
  }
  avgVX /= school.length;
  avgVY /= school.length;
  const avgSpd = Math.hypot(avgVX, avgVY);
  const normSpdX = (avgVX / avgSpd) * MAX_SPEED;
  const normSpdY = (avgVY / avgSpd) * MAX_SPEED;
  let steerX = normSpdX - fish.vx;
  let steerY = normSpdY - fish.vy;
  const mag = Math.hypot(steerX, steerY);
  if (mag > MAX_FORCE) {
    steerX = (steerX/mag) * MAX_FORCE;
    steerY = (steerY/mag) * MAX_FORCE;
  }
  return { x: steerX, y: steerY };
}

function cohesion(fish, school) {
  let avgX = 0;
  let avgY = 0;
  for (let i = 0; i < school.length; i++) {
    avgX += school[i].x;
    avgY += school[i].y;
  }
  if (school.length == 0) {
    return { x: 0, y: 0 };
  }
  avgX /= school.length;
  avgY /= school.length;
  const dx = avgX - fish.x;
  const dy = avgY - fish.y;
  const avgDist = Math.hypot(dx, dy);
  if (avgDist == 0) {
    return { x: 0, y: 0 };
  }
  const normX = (dx / avgDist) * MAX_SPEED;
  const normY = (dy / avgDist) * MAX_SPEED;
  let steerX = normX - fish.vx;
  let steerY = normY - fish.vy;
  const mag = Math.hypot(steerX, steerY);
  if (mag > MAX_FORCE) {
    steerX = (steerX/mag) * MAX_FORCE;
    steerY = (steerY/mag) * MAX_FORCE;
  }
  return { x: steerX, y: steerY };
}

function buildGrid(allFish) {
  const grid = new Map();
  for (let i = 0; i < allFish.length; i++) {
    let cellX = Math.floor(allFish[i].x / CELL_SIZE);
    let cellY = Math.floor(allFish[i].y / CELL_SIZE);
    const key = `${cellX},${cellY}`;
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key).push(allFish[i]);
  }
  return grid;
}

step();
