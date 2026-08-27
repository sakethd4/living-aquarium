const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const fishies = [];

const FISH_COUNT = 40;
const MIN_SIZE = 6;
const MAX_SIZE = 16;

const MIN_SPEED = 1.5;
const MAX_SPEED = 5;
const MAX_FORCE = 0.25;
const SEPARATION_RADIUS = 75;
const WANDER_STRENGTH = 0.25;
const MIN_FELT_DIST = 1;
const SENSE_RADIUS = SEPARATION_RADIUS / ((MIN_SIZE + MAX_SIZE) / 2);
const ALIGNMENT_RADIUS = 200;


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
  for (let i = 0; i < fishies.length; i++) {
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
  for (let i = 0; i < fishies.length; i++) {
    const fish = fishies[i];
    let ax = (Math.random() - 0.5) * WANDER_STRENGTH;
    let ay = (Math.random() - 0.5) * WANDER_STRENGTH;

    const neighbors = getNeighbors(fish, fishies, fish.size * SENSE_RADIUS);
    const sep = seperation(fish, neighbors);
    const school = getNeighbors(fish, fishies, ALIGNMENT_RADIUS);
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
      (Math.random() * (MAX_SIZE - MIN_SIZE)) + MIN_SIZE
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

step();
