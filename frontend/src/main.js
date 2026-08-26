const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const fishies = [];

class Fish {
  constructor (x, y, size, heading, speed, turnRate) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.heading = heading;
    this.speed = speed;
    this.turnRate = turnRate;
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
    ctx.rotate(fishies[i].heading);
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
    fishies[i].turnRate += (Math.random() - 0.5) * 0.005;
    let neighbors = getNeighbors(fishies[i], fishies, 100);
    seperation(fishies[i], neighbors);
    fishies[i].turnRate = Math.max(-0.01, Math.min(0.01, fishies[i].turnRate));
    fishies[i].heading += fishies[i].turnRate;
    fishies[i].speed += (Math.random() - 0.5) * 0.1;
    fishies[i].speed = Math.max(1, Math.min(4, fishies[i].speed));
    fishies[i].x += fishies[i].speed * Math.cos(fishies[i].heading);
    fishies[i].y += fishies[i].speed * Math.sin(fishies[i].heading);
    if (fishies[i].x > canvas.width || fishies[i].x < 0) {
      fishies[i].heading = Math.PI - fishies[i].heading;
      fishies[i].x = Math.max(0, Math.min(canvas.width, fishies[i].x))
    }
    if (fishies[i].y > canvas.height || fishies[i].y < 0) {
      fishies[i].heading = -fishies[i].heading;
      fishies[i].y = Math.max(0, Math.min(canvas.height, fishies[i].y))
    }
  }
}

function makeFish() { 
  for (let i = 0; i < 20; i++) {
    fishies.push(new Fish(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      (Math.random() * (11 - 9)) + 9,
      Math.random() * 2 * Math.PI,
      (Math.random() * (7 - 4)) + 4,
      0
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
  let totalX = 0;
  let totalY = 0;
  let seperationStrength = 10 * Math.PI;
  for (let i = 0; i < neighbors.length; i++) {
    let pushX = fish.x - neighbors[i].x;
    let pushY = fish.y - neighbors[i].y;
    let dist = Math.sqrt(pushX ** 2 + pushY ** 2);
    let normX = pushX / dist;
    let normY = pushY / dist;
    let weightX = Math.max(-10, Math.min(10, normX * (1 / dist)));
    let weightY = Math.max(-10, Math.min(10, normY * (1 / dist)));
    totalX += weightX;
    totalY += weightY;
  }
  fish.turnRate += Math.atan2(totalY, totalX) / seperationStrength;
}

step();
