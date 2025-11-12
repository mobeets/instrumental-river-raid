// ===== Global Parameters =====
let RIVER_PERCENT = 0.8;
let TREE_SPAWN_RATE = 0.03;
let PROP_BOAT_WIDTH = 0.25;
let FPS = 60;
let SCROLL_TIME = 2; // seconds to go from top to bottom
var DRIFT_SPEED = 4;
let MAX_PROJECTILES = 1;

let MAX_BOATS = 1;
let K = 4; // number of boat colors
let D = 3; // number of projectile types
let L = 5; // starting lives

// KxD binary rule matrix: R[k][d] = 1 means projectile d destroys color k
let R = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1]
];

// ===== Globals =====
let isPaused = false;
let jet;
let trees = [];
let boats = [];
let projectiles = [];
let explosions = [];
let animations = [];
let riverWidth, riverX;
let score = 0;
let streakbar; // number of hits in a row
let streakBarMax = 3; // required streak for point bonus
let streakBonus = 10; // points for filling streak bar
let lives = L;
let BOAT_COLORS = []; // filled later in setup()

// ===== Assets =====

let myFont;
let riverImg;
let jetImg;
let grassImg;
let stoneImg;
function preload() {
  myFont = loadFont('assets/LuckiestGuy-Regular.ttf');
  riverImg = loadImage('assets/river.png');
  jetImg = loadImage('assets/jet.png');
  grassImg = loadImage('assets/grass.png');
  stoneImg = loadImage('assets/stone.png');
}

// ===== Classes =====

class Grass {
  constructor(img, riverPercent) {
    this.img = img;
    this.riverPercent = riverPercent;

    // compute side widths
    this.sideWidth = (width * (1 - this.riverPercent)) / 2;
    this.scroll = 0;
    this.speed = DRIFT_SPEED; // same as river for consistent drift
  }

  update() {
    this.scroll += this.speed;
    if (this.scroll >= this.img.height) {
      this.scroll = 0;
    }
  }

  render() {
    imageMode(CORNER);
    // Left strip
    for (let y = -this.img.height; y < height; y += this.img.height) {
      image(this.img, 0, y + this.scroll, this.sideWidth, this.img.height);
    }

    // Right strip
    for (let y = -this.img.height; y < height; y += this.img.height) {
      image(this.img, width - this.sideWidth, y + this.scroll, this.sideWidth, this.img.height);
    }
  }
}

class River {
  constructor(img, percent) {
    this.img = img;
    this.percent = percent;
    this.width = width * this.percent;
    this.x = width / 2 - this.width / 2;
    this.scroll = 0;
    this.speed = DRIFT_SPEED; // pixels per frame
  }

  update() {
    this.scroll += this.speed;
    if (this.scroll >= this.img.height) {
      this.scroll = 0;
    }
  }

  render() {
    // Tile vertically to fill the screen
    for (let y = -this.img.height; y < height; y += this.img.height) {
      imageMode(CORNER);
      image(this.img, this.x, y + this.scroll, this.width, this.img.height);
    }
  }
}

class Jet {
  constructor(img, x, y) {
    this.img = img;
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 60;
    this.speed = 7;
    this.hitTime = 0;
  }
  
  takeHit() {
    this.hitTimer = 32; // number of frames for animation
  }

  update() {
    if (keyIsDown(LEFT_ARROW)) this.x -= this.speed;
    if (keyIsDown(RIGHT_ARROW)) this.x += this.speed;
    this.x = constrain(this.x, this.width / 2, width - this.width / 2);
  }

  render() {
    imageMode(CENTER);
    if (this.hitTimer > 0 && this.hitTimer % 16 < 8) {
      blendMode(DIFFERENCE);
      image(this.img, this.x, this.y, this.width, this.height);
      blendMode(BLEND);
    } else {
      image(this.img, this.x, this.y, this.width, this.height);
    }
    if (this.hitTimer > 0) {
      this.hitTimer--;
    }
  }
}

class Tree {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = random(10, 20);
    this.speed = DRIFT_SPEED;
  }
  update() {
    this.y += this.speed;
  }
  render() {
    push();
    translate(this.x, this.y);
    fill(0, 150, 0);
    noStroke();
    triangle(0, -this.size, -this.size / 2, this.size / 2, this.size / 2, this.size / 2);
    pop();
  }
  offscreen() {
    return this.y - this.size > height;
  }
}

class Boat {
  constructor(img, x, y) {
    this.img = img;
    this.x = x;
    this.y = y;
    this.width = width*PROP_BOAT_WIDTH;
    this.height = 30;
    this.speed = DRIFT_SPEED;
    this.colorIndex = int(random(K));
    this.color = BOAT_COLORS[this.colorIndex];
  }

  update() {
    this.y += this.speed;
  }

  render() {
    push();
    imageMode(CENTER);
    tint(this.color);

    let N = this.width / this.height; // number of tiles horizontally
    let tileW = this.height;          // each tile is square (height x height)
    let startX = this.x - this.width / 2 + tileW / 2; // leftmost tile center

    for (let i = 0; i < N; i++) {
      let tileX = startX + i * tileW;
      image(this.img, tileX, this.y, tileW, this.height);
    }

    pop();
    noTint();
  }

  offscreen() {
    return this.y - this.height / 2 > height;
  }

  collidesWithJet(jet) {
    return !(
      this.x + this.width / 2 < jet.x - jet.width / 2 || // boat is left of jet
      this.x - this.width / 2 > jet.x + jet.width / 2 || // boat is right of jet
      this.y + this.height / 2 < jet.y - jet.height / 2 || // boat is above jet
      this.y - this.height / 2 > jet.y + jet.height / 2    // boat is below jet
    );
  }

  checkHit(projectile) {
    return (
      abs(this.x - projectile.x) < this.width / 2 &&
      abs(this.y - projectile.y) < this.height / 2
    );
  }
}

class Projectile {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.speed = 8;
    this.type = type; // 1..D
    this.sizes = [8, 8, 8];
    this.colors = [color(0,0,0), color(0,0,0), color(0,0,0)];
  }

  update() {
    this.y -= this.speed;
  }

  render() {
    push();
    translate(this.x, this.y);
    fill(this.colors[this.type-1]);
    noStroke();
    ellipse(0, 0, this.sizes[this.type-1]);
    pop();
  }

  offscreen() {
    return this.y + this.sizes[this.type-1] < 0;
  }
}

class Explosion {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = 10;
  }

  update() {
    this.life--;
  }

  render() {
    push();
    noStroke();
    fill(this.color[0], this.color[1], this.color[2], map(this.life, 10, 0, 255, 0));
    ellipse(this.x, this.y, (10 - this.life) * 3);
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

class StreakBar {
  constructor() {
    this.x = width/2;
    this.y = 4;
    this.height = 23;
    this.width = 0.2*width;
    this.streak = 0;
    this.maxStreak = streakBarMax;
  }
  
  reset() {
    this.streak = 0;
  }
  
  hit() {
    this.streak++;
    if (this.streak >= this.maxStreak) {
      this.streak = 0;
      animations.push(new ScoreBonus(score, streakBonus));
    }
  }
  
  render() {
    rectMode(CORNER);
    push();
    translate(this.x, this.y);
    noStroke();
    fill('green');
    rect(0, 0, map(this.streak, 0, this.maxStreak, 0, this.width), this.height);
    stroke('white');
    strokeWeight(2);
    noFill();
    rect(0, 0, this.width, this.height);
    pop();
  }
}

class ScoreBonus {
  constructor(score, scoreToAdd) {
    this.scoreTarget = score + scoreToAdd;
    this.lastRefresh = millis();
  }

  update() {
    if (score < this.scoreTarget) {
      if (millis()-this.lastRefresh > 35) {
        score++;
        this.lastRefresh = millis();
      }
    }
  }

  render() {
    // don't need to do anything here
  }

  isDead() {
    return score >= this.scoreTarget;
  }
}

// ====== p5.js setup and draw ======
function setup() {
  createCanvas(600, 600);
  
  // set drift speed to maintain fixed scroll times
  DRIFT_SPEED = height / (FPS * SCROLL_TIME);
  
  river = new River(riverImg, RIVER_PERCENT);
  grass = new Grass(grassImg, RIVER_PERCENT);

  // Define boat colors here (p5 color() now available)
  BOAT_COLORS = [
    color(255, 0, 0),
    color(255, 0, 255),
    color(0, 255, 255),
    color(255, 255, 0)
  ];

  computeRiverGeometry();
  jet = new Jet(jetImg, width / 2, height - 40);
  streakbar = new StreakBar();
  
  textAlign(CENTER, CENTER);
  textSize(24);
}

function draw() {
  frameRate(FPS);
  
  background(34, 139, 34);
  
  if (!isPaused) {
    grass.update();
    
    // Spawn boats (limited by MAX_BOATS)
    if (boats.length < MAX_BOATS && random(1) < 0.02) {
      boats.push(new Boat(stoneImg, random(riverX + 20, riverX + riverWidth - 20), -20));
    }

    // Update and render boats
    for (let i = boats.length - 1; i >= 0; i--) {
      boats[i].update();

      // Check collision with jet
      if (boats[i].collidesWithJet(jet)) {
        boats.splice(i, 1);
        jet.takeHit();
        streakbar.reset();
        
        explosions.push(new Explosion(jet.x, jet.y-jet.height/2, [255, 150, 0]));
        
        lives--;
      } else if (boats[i].offscreen()) {
        boats.splice(i, 1);
      }
    }

    // Update and render projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      let p = projectiles[i];
      p.update();

      // Check for collisions with boats
      for (let j = boats.length - 1; j >= 0; j--) {
        if (boats[j].checkHit(p)) {
          if (R[boats[j].colorIndex][p.type - 1] === 1) {
            // Correct hit
            score++;
            streakbar.hit();
            explosions.push(new Explosion(boats[j].x, boats[j].y+10, [255, 150, 0]));
            explosions.push(new Explosion(boats[j].x - boats[j].width/3, boats[j].y+10, [255, 150, 0]));
            explosions.push(new Explosion(boats[j].x + boats[j].width/3, boats[j].y+10, [255, 150, 0]));
            boats.splice(j, 1);
            projectiles.splice(i, 1);
            break;
          }
        }
      }

      if (p.offscreen()) {
        streakbar.reset();
        projectiles.splice(i, 1);
      }
    }

    // Update jet
    jet.update();
  }

  // render grass, boats, projectiles, and jet
  grass.render();
  for (let i = boats.length - 1; i >= 0; i--) {
    boats[i].render();
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.render();
  }
  jet.render();

  // Update/render explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update();
    explosions[i].render();
    if (explosions[i].isDead()) explosions.splice(i, 1);
  }
  
  // Update/render other animations (e.g., score bonus)
  for (let i = animations.length - 1; i >= 0; i--) {
    animations[i].update();
    animations[i].render();
    if (animations[i].isDead()) animations.splice(i, 1);
  }

  drawHUD();
  streakbar.render();

  if (lives <= 0) {
    noLoop();
    textSize(48);
    fill(255);
    textAlign(CENTER, CENTER);
    text("GAME OVER", width / 2, height / 2);
  } else if (isPaused) {
    textSize(48);
    fill(255);
    textAlign(CENTER, CENTER);
    text("PAUSED", width / 2, height / 2);
  }
}

// ====== HUD ======
function drawHUD() {
  fill('black');
  rect(0, 0, width, 30);
  textSize(24);
  
  // Score
  textFont(myFont);
  fill(255);
  textAlign(RIGHT, TOP);
  if (animations.length > 0) {
    textSize(30);
    fill('yellow');
  }
  text("Score: " + score, width - 20, 5);

  // Lives
  fill(255);
  textSize(24);
  textFont('Helvetica');
  textAlign(LEFT, TOP);
  fill(255, 0, 0);
  for (let i = 0; i < lives; i++) {
    text("♥", 20 + i * 25, 5);
  }
}

// ====== Helpers ======
function computeRiverGeometry() {
  riverWidth = width * RIVER_PERCENT;
  riverX = width / 2 - riverWidth / 2;
}

function randomLandX() {
  let side = random() < 0.5 ? "left" : "right";
  if (side === "left") {
    return random(0, riverX);
  } else {
    return random(riverX + riverWidth, width);
  }
}

// ====== Firing control ======
function keyPressed() {
  if (key >= '1' && key <= String(D)) {
    let type = int(key);
    if (projectiles.length < MAX_PROJECTILES) {
      projectiles.push(new Projectile(jet.x, jet.y - 30, type));
    }
  } else if (key === 'p') {
    isPaused = !isPaused;
  }
}
