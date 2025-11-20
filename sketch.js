// ===== Global Parameters =====
let FPS = 60; // frames per second
let SCROLL_TIME = 2; // seconds for cue to travel top to bottom
let MAX_PROJECTILES = 1; // max shots allowed on screen at same time
let MAX_BOATS = 1; // max number of cues on screen at same time
let ITI_MEAN = 0.8; // mean of ITI distribution, in seconds
let PROP_RIVER_WIDTH = 0.8; // proportion of screen taken up by cue area
let PROP_CUE_WIDTH = 0.2; // size of cue in pixels
let showHUD = false;

let K = 4; // number of boat colors
let D = 3; // number of projectile types
let L = 5; // starting lives
let R; // reward matrix

// ===== Photodiode settings =====
let photodiode_params = {size: 50};
let photodiode;

// ===== Data settings =====
let logger;
let trials = [];

// ===== Globals =====
let DRIFT_SPEED; // will be set to ensure fixed travel time from top to bottom
let JET_SPEED; // will be set to allow fixed travel time from left to right
let cueWidth;
let isPaused = false;
let immobileMode = false;
let showAnswers = true; // show number on block instead of color
let jet;
let trees = [];
let boats = [];
let projectiles = [];
let explosions = [];
let animations = [];
let riverWidth, riverX;
let score = 0;
let streakbar; // number of hits in a row
let streakBarMax = 5; // required streak for point bonus
let streakBonus = 10; // points for filling streak bar
let framesInGame = 0;
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

function randomR(rows, cols) {
  // creates random KxD binary reward matrix
  // each row will have exactly one nonzero entry
  // R[k][d] = 1 means projectile d destroys color k
  // let R = [
  //   [1, 0, 0],
  //   [0, 1, 0],
  //   [0, 0, 1],
  //   [1, 0, 1]
  // ];
  let R = [];
  for (let i = 0; i < rows; i++) {
    let row = Array(cols).fill(0);
    row[Math.floor(Math.random() * cols)] = 1; // choose one random position
    R.push(row);
  }
  return R;
}

function newGame() {
  // make new reward matrix
  R = randomR(K, D);

  framesInGame = 0;
  score = 0;
  lives = L;
  streakbar.reset();
  boats = [];
  projectiles = [];
  explosions = [];
  animations = [];
}

// ====== p5.js setup and draw ======
function setup() {
  // let windowSize = min(windowWidth, windowHeight);
  // let cnv = createCanvas(windowSize, windowSize);
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('canvas-container'); // attach to the centered div

  logger = new EventLogger();
  photodiode = new Photodiode(photodiode_params, width, height);
  
  // set drift speed to maintain fixed scroll times
  DRIFT_SPEED = height / (FPS * SCROLL_TIME);
  JET_SPEED = width / (FPS * 2);
  cueWidth = width*PROP_CUE_WIDTH;
  
  river = new River(riverImg, PROP_RIVER_WIDTH);
  grass = new Grass(grassImg, PROP_RIVER_WIDTH);

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
  newGame();
}

function draw() {
  frameRate(FPS);
  background(34, 139, 34);
  
  if (!isPaused) {
    framesInGame++;
    grass.update();
    
    // Spawn boats (limited by MAX_BOATS)
    let iti_p = 1/(ITI_MEAN*FPS);
    if (boats.length < MAX_BOATS && random(1) < iti_p) {
      boats.push(new Boat(stoneImg, random(riverX + cueWidth/2, riverX + riverWidth - cueWidth/2), -20));
    }

    // Update and render boats
    for (let i = boats.length - 1; i >= 0; i--) {
      boats[i].update();

      if (boats[i].collidesWithJet(jet)) {
        if (!immobileMode) {
        // Check collision with jet
          boats.splice(i, 1);
          jet.takeHit();
          streakbar.reset();
          
          explosions.push(new Explosion(jet.x, jet.x, jet.y-jet.height, [255, 150, 0]));
          
          lives--;
        }
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
            let dx = boats[j].width/2;
            let cy = boats[j].y - boats[j].height/2;
            explosions.push(new Explosion(boats[j].x - dx, boats[j].x + dx, cy, [255, 150, 0]));
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

  if (showHUD) {
    drawHUD();
    streakbar.update();
    streakbar.render();
  }

  if (showHUD && lives <= 0) {
    isPaused = true;
  }
  if (isPaused) {
    drawPauseScreen();
  }

  // render photodiode last
  photodiode.update();
  photodiode.render();
}

function drawPauseScreen() {
  textSize(48);
  fill(255);
  textAlign(CENTER, CENTER);
  textFont(myFont);
  let statusStr = "PAUSED";
  if (showHUD && lives <= 0) {
    statusStr = 'GAME OVER';
  } else if (framesInGame === 0) {
    statusStr = 'NEW GAME';
  }
  text(statusStr, width / 2, height / 2);

  fill('black');
  textSize(32);
  let modeStr;
  if (immobileMode) {
    modeStr = 'Stationary';
  } else {
    modeStr = 'Dynamic';
  }
  text("Mode ('M'): " + modeStr, width / 2, 5*height/8);

  let ansStr;
  if (showAnswers) {
    ansStr = 'Showing';
  } else {
    ansStr = 'Hiding';
  }
  text(ansStr + " answers ('A')", width / 2, 5*height/8 + 40);
  if (framesInGame > 0) {
    text("'N' for new game", width / 2, 5*height/8 + 80);
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
  if (streakbar.isAnimating) {
    textSize(30);
    fill('yellow');
  }
  text("Score: " + score, width - 20, 5);

  if (!immobileMode) {
    // Show lives as hearts
    fill(255);
    textSize(24);
    textFont('Helvetica');
    textAlign(LEFT, TOP);
    fill(255, 0, 0);
    for (let i = 0; i < lives; i++) {
      text("♥", 20 + i * 25, 5);
    }
  }
}

// ====== Helpers ======
function computeRiverGeometry() {
  riverWidth = width * PROP_RIVER_WIDTH;
  riverX = width / 2 - riverWidth / 2;
}

// ====== Firing control ======
function keyPressed(event) {
  let eventMsg;
  if (!isPaused && key >= '1' && key <= String(D)) {
    // fire projectile
    eventMsg = 'projectile fired ' + key;
    let type = int(key);
    if (projectiles.length < MAX_PROJECTILES) {
      projectiles.push(new Projectile(jet.x, jet.y - 30, type));
    }
  } else if (key === 'p') {
    // toggle paused
    eventMsg = 'toggle paused';
    isPaused = !isPaused;
  } else if (isPaused) {
    if (key === 'n') {
      // start new game
      eventMsg = 'new game';
      newGame();
    } else if (key === 'm') {
      // toggle mode
      eventMsg = 'toggle mode';
      immobileMode = !immobileMode;
      newGame();
    } else if (key === 'a') {
      eventMsg = 'toggle answers';
      showAnswers = !showAnswers;
      newGame();
    } else if (key === 's') {
      saveTrials();
    }
  }
  logger.log(event, event.timeStamp, eventMsg);
}

function isPressingLeft() {
  if (keyIsDown(LEFT_ARROW)) { console.log('here'); return true; }
  if (mouseIsPressed && mouseX < width/2) return true;
  return false;
}

function isPressingRight() {
  if (keyIsDown(RIGHT_ARROW)) return true;
  if (mouseIsPressed && mouseX > width/2) return true;
  return false;
}

function keyReleased() {
  logger.log(event, event.timeStamp);
}

function mousePressed() {
  logger.log(event, event.timeStamp);
}

function mouseReleased() {
  logger.log(event, event.timeStamp);
}

function getGameInfo() {
  return {
    width: width,
    height: height,
    showHUD: showHUD,
    photodiode: photodiode,
    framesInGame: framesInGame,
    streakBonus: streakBonus,
    streakBarMax: streakBarMax,
    JET_SPEED: JET_SPEED,
    DRIFT_SPEED: DRIFT_SPEED,
    R: R,
    K: K,
    D: D,
    L: L,
    cueWidth: cueWidth,
    PROP_CUE_WIDTH: PROP_CUE_WIDTH,
    PROP_RIVER_WIDTH: PROP_RIVER_WIDTH,
    ITI_MEAN: ITI_MEAN,
    MAX_BOATS: MAX_BOATS,
    MAX_PROJECTILES: MAX_PROJECTILES,
    SCROLL_TIME: SCROLL_TIME,
    FPS: FPS,
  };
}

function saveTrials() {
  logger.data.gameInfo = getGameInfo();
  logger.data.trials = trials;
  logger.download();
}
