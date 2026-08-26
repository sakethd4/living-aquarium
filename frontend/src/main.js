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
    fishies[i].turnRate = Math.max(-0.01, Math.min(0.01, fishies[i].turnRate));
    fishies[i].heading += fishies[i].turnRate;
    fishies[i].speed += (Math.random() - 0.5) * 0.1;
    fishies[i].speed = Math.max(1, Math.min(4, fishies[i].speed));s
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

step();
