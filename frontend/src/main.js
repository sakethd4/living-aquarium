const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const fishies = [];

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
    fishies[i].vx += Math.random() - 0.5; 
    fishies[i].vy += Math.random() - 0.5;
    const speed = Math.sqrt(fishies[i].vx ** 2 + fishies[i].vy ** 2);
    if (speed > 10) {
      if (fishies[i].vx != 0) {
        fishies[i].vx -= fishies[i].vx/speed;
      }
      if (fishies[i].vy != 0) {
        fishies[i].vy -= fishies[i].vy/speed;
      }
    } 
    if (speed < 3) {
      if (fishies[i].vx != 0) {
        fishies[i].vx += fishies[i].vx/speed;
      }
      if (fishies[i].vy != 0) {
        fishies[i].vy += fishies[i].vy/speed;
      }
    }
    if (fishies[i].x > canvas.width || fishies[i].x < 0) {
      fishies[i].vx *= -1;
    }
    if (fishies[i].y > canvas.height || fishies[i].y < 0) {
      fishies[i].vy *= -1;
    }
    fishies[i].x = fishies[i].x + fishies[i].vx;
    fishies[i].y = fishies[i].y + fishies[i].vy;
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

step();
