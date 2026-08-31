const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const fishies = [];

// fish stuff
const FISH_COUNT = 500;
const MIN_SIZE = 4;
const MAX_SIZE = 8;
const DEPTH_SIZE_MIN = 0.4;   
const DEPTH_SIZE_MAX = 1.2;
const MIN_ENERGY = 50;
const MAX_ENERGY = 1000;
const AVG_SIZE = (MAX_SIZE + MIN_SIZE) / 2;

// moving a fish stuff
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const AVG_SPEED = (MIN_SPEED + MAX_SPEED) / 2;
const MAX_FORCE = 0.2;
const SEPARATION_RADIUS = 75;
const WANDER_STRENGTH = 0.6 ;
const MIN_FELT_DIST = 10;
const SENSE_RADIUS = SEPARATION_RADIUS / ((MIN_SIZE + MAX_SIZE) / 2);
const ALIGNMENT_RADIUS = 60;
const CELL_SIZE = Math.max(ALIGNMENT_RADIUS, MAX_SIZE * SENSE_RADIUS);
const FOV_BASELINE = 0.3;
const HEADING_SMOOTHING = 0.15;
const VERTICAL_BIAS = 0.6;

const SEPARATION_WEIGHT = 0.9;
const ALIGNMENT_WEIGHT = 1;
const COHESION_WEIGHT = 0.9;

const ENERGY_LOSS_RATE = 0.1;

// parallax stuff
const DEPTH_SPEED_MIN = 0.3;
const DEPTH_ALPHA_MIN = 0.25;

// food stuff
const foods = [];
const FOOD_COUNT = 80;
const FOOD_GROWTH_RATE = 0.002;
const FOOD_MAX_RADIUS = 3;
const MOUTH_SIZE_FACTOR = 0.5;
const REPLENISH_FACTOR = 1000;
const FOOD_SEEK_RADIUS = 150;
const FOOD_SEEK_WEIGHT = 0.5;

class Food {
  constructor (x, y) {
    this.x = x;
    this.y = y;
    this.maturity = 0;
  }
}

class Fish {
  constructor (x, y, vx, vy, size, color, wagPhase, depth, energy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.color = color;
    this.tailPhase = wagPhase;
    this.renderAngle = Math.atan2(vy, vx);
    this.depth = depth;
    this.energy = energy;
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
makeFish();
makeFood();


function step() {
  // Phase 1: render fish here.
  drawBackground();
  drawFood();
  drawFish();
  moveFish();
  growFood();
  requestAnimationFrame(step);
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  const vertical = ctx.createLinearGradient(0, 0, 0, h);
  vertical.addColorStop(0, "#3a7ea8");
  vertical.addColorStop(1, "#000a3f");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.hypot(cx, cy);
  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  radial.addColorStop(0, "rgba(7, 52, 97, 0)");
  radial.addColorStop(1, "rgba(0, 58, 109, 0.85)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);
}

function drawFish() {
  fishies.sort((a, b) => a.depth - b.depth); // draw far fish first so near fish occlude them
  for (let i = 0; i < fishies.length; i++) {
    const fish = fishies[i];
    const depthScale = DEPTH_SIZE_MIN + (DEPTH_SIZE_MAX - DEPTH_SIZE_MIN) * fish.depth;
    const s = fish.size * depthScale;
    const wag = Math.sin(fish.tailPhase) * 0.2;

    ctx.save();
    ctx.globalAlpha = DEPTH_ALPHA_MIN + (1 - DEPTH_ALPHA_MIN) * fish.depth;
    ctx.translate(fish.x, fish.y);
    ctx.rotate(fish.renderAngle);

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
    eatFood(fish, foods);
    fish.energy = Math.max(0, (fish.energy - ((fish.size / AVG_SIZE) + (Math.hypot(fish.vx, fish.vy) / AVG_SPEED)) * ENERGY_LOSS_RATE));
    let ax = (Math.random() - 0.5) * WANDER_STRENGTH;
    let ay = (Math.random() - 0.5) * WANDER_STRENGTH;

    const neighbors = getNeighbors(fish, grid, fish.size * SENSE_RADIUS);
    const sep = seperation(fish, neighbors);
    const school = getNeighbors(fish, grid, ALIGNMENT_RADIUS);
    const align = alignment(fish, school);
    const coh = cohesion(fish, school);
    const seek = seekFood(fish, foods);

    const hunger = Math.max(0, Math.min(1, 1 - fish.energy / MAX_ENERGY));
    const dynamicCohesionWeight = Math.max(COHESION_WEIGHT * (1 - hunger), 0.8);
    const dynamicSeekWeight = FOOD_SEEK_WEIGHT * hunger;

    ax = ax + SEPARATION_WEIGHT * sep.x + ALIGNMENT_WEIGHT * align.x + dynamicCohesionWeight * coh.x + dynamicSeekWeight * seek.x;
    ay = ay + SEPARATION_WEIGHT * sep.y + ALIGNMENT_WEIGHT * align.y + dynamicCohesionWeight * coh.y + dynamicSeekWeight * seek.y;
    ay *= VERTICAL_BIAS;

    fish.vx += ax;
    fish.vy += ay;

    const depthSpeedScale = DEPTH_SPEED_MIN + (1 - DEPTH_SPEED_MIN) * fish.depth;
    const fishMaxSpeed = MAX_SPEED * depthSpeedScale;
    const fishMinSpeed = MIN_SPEED * depthSpeedScale;

    const speed = Math.hypot(fish.vx, fish.vy);
    if (speed > fishMaxSpeed) {
      fish.vx = (fish.vx / speed) * fishMaxSpeed;
      fish.vy = (fish.vy / speed) * fishMaxSpeed;
    } else if (speed > 0 && speed < fishMinSpeed) {
      fish.vx = (fish.vx / speed) * fishMinSpeed;
      fish.vy = (fish.vy / speed) * fishMinSpeed;
    }

    fish.tailPhase += speed * 0.1;

    const targetAngle = Math.atan2(fish.vy, fish.vx);
    const angleDiff = Math.atan2(Math.sin(targetAngle - fish.renderAngle), Math.cos(targetAngle - fish.renderAngle));
    fish.renderAngle += angleDiff * HEADING_SMOOTHING;

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
      Math.random() * Math.PI * 2,
      Math.random(),
      (Math.random() * (MAX_ENERGY - MIN_ENERGY)) + MIN_ENERGY,
    ));
  }
}

function makeFood() {
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push(new Food(
      Math.random() * canvas.width,
      Math.random() * canvas.height
    ));
  }
}

function growFood() {
  for (let i = 0; i < foods.length; i++) {
    foods[i].maturity = Math.min(1, foods[i].maturity + FOOD_GROWTH_RATE);
  }
}

function drawFood() {
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const radius = FOOD_MAX_RADIUS * food.maturity;
    ctx.beginPath();
    ctx.arc(food.x, food.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#8fd94f";
    ctx.fill();
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
  if (school.length == 0) {
    return { x: 0, y: 0 };
  }
  const facing = Math.atan2(fish.vy, fish.vx);
  let sumWeightedX = 0;
  let sumWeightedY = 0;
  let sumWeight = 0;
  for (let i = 0; i < school.length; i++) {
    const angleToNeighbor = Math.atan2(school[i].y - fish.y, school[i].x - fish.x);
    const angleDiff = angleToNeighbor - facing;
    const wrapped = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    const weight = FOV_BASELINE + (1 - FOV_BASELINE) * Math.max(0, Math.cos(wrapped));
    sumWeightedX += weight * school[i].x;
    sumWeightedY += weight * school[i].y;
    sumWeight += weight;
  }
  if (sumWeight == 0) {
    return { x: 0, y: 0 };
  }
  const avgX = sumWeightedX / sumWeight;
  const avgY = sumWeightedY / sumWeight;
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

function eatFood(fish, foods) {
  for (let i = 0; i < foods.length; i++) {
    let foodRadius = FOOD_MAX_RADIUS * foods[i].maturity;
    let maxBite = fish.size * MOUTH_SIZE_FACTOR;
    let canEat = foodRadius <= maxBite ? true : false;
    let dx = fish.x - foods[i].x;
    let dy = fish.y - foods[i].y;
    let dist = Math.hypot(dx, dy);
    let combinedSize = fish.size + foodRadius;
    if (dist <= combinedSize && canEat) {
      fish.energy = Math.min(MAX_ENERGY, fish.energy + foods[i].maturity * REPLENISH_FACTOR);
      foods[i].maturity = 0;
      foods[i].x = Math.random() * canvas.width;
      foods[i].y = Math.random() * canvas.height;
    }
  }
}

function seekFood(fish, foods) {
  let nearest = null;
  let nearestDist = FOOD_SEEK_RADIUS;
  for (let i = 0; i < foods.length; i++) {
    const foodRadius = FOOD_MAX_RADIUS * foods[i].maturity;
    const maxBite = fish.size * MOUTH_SIZE_FACTOR;
    if (foodRadius > maxBite) {
      continue; // too big for this fish to eat, not worth chasing
    }
    const dist = Math.hypot(fish.x - foods[i].x, fish.y - foods[i].y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = foods[i];
    }
  }
  if (nearest == null) {
    return { x: 0, y: 0 };
  }

  const dx = nearest.x - fish.x;
  const dy = nearest.y - fish.y;
  const dist = Math.hypot(dx, dy);
  const desiredX = (dx / dist) * MAX_SPEED;
  const desiredY = (dy / dist) * MAX_SPEED;
  let steerX = desiredX - fish.vx;
  let steerY = desiredY - fish.vy;
  const mag = Math.hypot(steerX, steerY);
  if (mag > MAX_FORCE) {
    steerX = (steerX / mag) * MAX_FORCE;
    steerY = (steerY / mag) * MAX_FORCE;
  }

  return { x: steerX, y: steerY };
}

step();
