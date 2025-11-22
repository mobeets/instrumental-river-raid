// ===== Data settings =====
let logger;
let config;
let E;
let trial_blocks = [];
let trial_block;
let trial;
let photodiode;

// ===== Globals =====
let L = 5; // starting lives
let streakBarMax = 5; // required streak for point bonus
let streakBonus = 10; // points for filling streak bar
let framesInGame = 0;
let R; // reward matrix
let driftSpeed; // will be set to ensure fixed travel time from top to bottom
let jetSpeed; // will be set to allow fixed travel time from left to right
let cueWidth;
let immobileMode = false;
let showAnswers = true; // show number on block instead of color
let jet;
let trees = [];
let boats = [];
let projectiles = [];
let explosions = [];
let animations = [];
let riverWidth, riverX;
let streakbar; // number of hits in a row
let lives = L;
let BOAT_COLORS = []; // filled later in setup()

const PLAY_MODE = 0;
const PAUSE_MODE = 1;
const STARTING_MODE = 2;
const READY_MODE = 3;
const COMPLETE_MODE = 4;
let gameMode = READY_MODE;

// ===== Assets =====

let myFont;
let riverImg;
let jetImg;
let grassImg;
let stoneImg;
let spriteSheet;
function preload() {
  myFont = loadFont('assets/LuckiestGuy-Regular.ttf');
  riverImg = loadImage('assets/river.png');
  jetImg1 = loadImage('assets/jet1.png');
  jetImg2 = loadImage('assets/jet2.png');
  grassImg = loadImage('assets/grass.png');
  // stoneImg = loadImage('assets/stone.png');
  spriteSheet = new SquareSpriteSheet('assets/animal-pack.png', 64);
  config = loadConfig();
}

function makeBalancedOneHotMatrix(rows, cols) {
  // Smallest N such that N*cols ≥ rows
  const N = Math.ceil(rows / cols);

  // Build stacked identity (size N*cols x cols)
  let M = [];
  for (let n = 0; n < N; n++) {
    for (let i = 0; i < cols; i++) {
      let row = Array(cols).fill(0);
      row[i] = 1;
      M.push(row);
    }
  }

  // Shuffle rows (Fisher–Yates)
  for (let i = M.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [M[i], M[j]] = [M[j], M[i]];
  }

  // Return first K rows
  return M.slice(0, rows);
}

function randomR(rows, cols, maxEntropyPolicy = false) {
  // creates random ncues x D binary reward matrix
  // each row will have exactly one nonzero entry
  // R[k][d] = 1 means projectile d destroys color k
  // if maxEntropyPolicy, then ensures every action is optimal for at least one cue
  if (maxEntropyPolicy) {
    return makeBalancedOneHotMatrix(rows, cols);
  }

  let R = [];
  for (let i = 0; i < rows; i++) {
    let row = Array(cols).fill(0);
    row[Math.floor(Math.random() * cols)] = 1; // choose one random position
    R.push(row);
  }
  return R;
}

function newGame(restartGame = false) {
  trial_block = E.next_block(restartGame);
  if (trial_block === undefined) { gameMode = COMPLETE_MODE; return; }
  if (E.block_index > 1) {
    gameMode = STARTING_MODE;
  } else {
    gameMode = READY_MODE;
  }
  if (trial_block.scene === 'grass') {
    grass.img = grassImg;
    jet.img = jetImg1;
  } else {
    grass.img = riverImg;
    jet.img = jetImg2;
  }

  if (trial_block.name === "targets") {
    immobileMode = false;
    showAnswers = true;
  } else if (trial_block.name === "instrumental") {
    immobileMode = true;
    showAnswers = false;
  } else if (trial_block.name === "targets-instrumental") {
    immobileMode = false;
    showAnswers = false;
  } else {
    console.log("Invalid game type.");
  }
  trial_blocks.push(trial_block);

  // make new reward matrix
  trial_block.R = randomR(trial_block.ncues, E.params.nactions, E.params.maxEntropyPolicy);

  framesInGame = 0;
  lives = L;
  if (E.params.showHUD) streakbar.reset();
  boats = [];
  projectiles = [];
  explosions = [];
  animations = [];
}

// ====== p5.js setup and draw ======
function setup() {
  E = new Experiment(config);

  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('canvas-container'); // attach to the centered div

  logger = new EventLogger();
  photodiode = new Photodiode(E.params.photodiode, width, height);
  
  // set drift speed to maintain fixed scroll times
  let jetOffset = 60;
  cueWidth = width*E.params.PROP_CUE_WIDTH;
  driftSpeed = (height-jetOffset) / (E.params.FPS * E.params.SCROLL_TIME);
  jetSpeed = (width-cueWidth) / (E.params.FPS * 2);
  
  river = new River(riverImg, E.params.PROP_RIVER_WIDTH);
  grass = new Grass(grassImg, E.params.PROP_RIVER_WIDTH);

  // Define boat colors here (p5 color() now available)
  BOAT_COLORS = [
    color(255, 0, 0),
    color(255, 0, 255),
    color(0, 255, 255),
    color(255, 255, 0),
    color(0, 0, 255),
    color(0, 255, 0),
  ];

  riverWidth = width * E.params.PROP_RIVER_WIDTH;
  riverX = width / 2 - riverWidth / 2;
  jet = new Jet(jetImg1, width / 2, height - jetOffset);
  streakbar = new StreakBar();
  
  textAlign(CENTER, CENTER);
  textSize(24);
  newGame(false);
}

function draw() {
  frameRate(E.params.FPS);
  if (gameMode == PLAY_MODE) {
    if (trial_block.scene === 'grass') {
      background(34, 139, 34);
    } else {
      background('#496FB6');
    }
  } else {
    background('gray');
  }

  if (gameMode == PLAY_MODE) {
    framesInGame++;
    grass.update();

    // Start next trial if necessary
    let iti_p = 1/(E.params.ITI_MEAN*E.params.FPS);
    if (boats.length < E.params.MAX_BOATS && random(1) < iti_p) {
      trial = trial_block.next_trial();
      if (trial === undefined) {
        newGame(false);
      } else {
        boats.push(new Boat(trial.cue-1, random(riverX + cueWidth/2, riverX + riverWidth - cueWidth/2), -cueWidth));
      }
    }

    // Update and render boats
    for (let i = boats.length - 1; i >= 0; i--) {
      boats[i].update();

      if (!boats[i].hasBeenSeen && boats[i].onscreen()) trial.trigger('cue onset');
      if (boats[i].collidesWithJet(jet)) {
        // Collided with jet
        if (!immobileMode) {
          boats.splice(i, 1);
          jet.takeHit();
          streakbar.reset();
          trial.trigger('collision');
          trial.trigger('cue offset');
          
          explosions.push(new Explosion(jet.x, jet.x, jet.y-jet.height, [255, 150, 0]));
          
          lives--;
        }
      } else if (boats[i].offscreen()) {
        // trial ends without a hit
        trial.trigger('cue offset');
        boats.splice(i, 1);
      }
    }

    // Update and render projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      let p = projectiles[i];
      p.update();
      let pIsAboveBoat = false;

      // Check for collisions with boats
      for (let j = boats.length - 1; j >= 0; j--) {
        if (boats[j].checkHit(p)) {
          if (trial_block.R[boats[j].cue][p.action - 1] === 1) {
            // Correct hit
            trial.trigger('hit');
            trial.trigger('cue offset');
            trial_block.score++;

            if (E.params.showHUD) streakbar.hit();
            let dx = boats[j].width/2;
            let cy = boats[j].y - boats[j].height/2;
            explosions.push(new Explosion(boats[j].x - dx, boats[j].x + dx, cy, [255, 150, 0]));
            boats.splice(j, 1);
            projectiles.splice(i, 1);
            break;
          }
        } else if (!E.params.bulletsPassThru && p.y < boats[j].y - boats[j].height/2) {
          // bullet is incorrect, so we make it disappear
          pIsAboveBoat = true;
        }
      }

      if (pIsAboveBoat || p.offscreen()) {
        if (E.params.showHUD) streakbar.reset();
        trial.trigger({name: 'projectile offset', index: p.action});
        projectiles.splice(i, 1);
      }
    }

    // Update jet
    jet.update();
  }

  // render grass, boats, projectiles, and jet
  if (gameMode == PLAY_MODE) {
    grass.render();
    for (let i = boats.length - 1; i >= 0; i--) {
      boats[i].render();
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      let p = projectiles[i];
      p.render();
    }
    jet.render();
  }

  // Update/render explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update();
    explosions[i].render();
    if (explosions[i].isDead()) explosions.splice(i, 1);
  }

  if (E.params.showHUD) {
    drawHUD();
    streakbar.update();
    streakbar.render();
  }

  if (E.params.showHUD && lives <= 0) {
    newGame(false);
  }
  if (gameMode != PLAY_MODE) {
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

  if (gameMode == PAUSE_MODE) {
    text("PAUSED", width / 2, height / 2);
  } else if (gameMode == STARTING_MODE) {
    text("GAME COMPLETE", width / 2, height / 2);

    fill('black');
    textSize(32);
    text("Game " + (E.block_index+1).toFixed(0) + " of " + E.block_configs.length.toFixed(0), width / 2, 5*height/8 + 0);
    text("Score: " + trial_block.score.toFixed(0) + " out of " + trial_block.trials.length, width / 2, 5*height/8 + 0);
  } else if (gameMode == READY_MODE) {
    text("READY?", width / 2, height / 2);
    fill('black');
    textSize(32);
    text("Game " + (E.block_index+1).toFixed(0) + " of " + E.block_configs.length.toFixed(0), width / 2, 5*height/8 + 0);
    fill('white');
    if (trial_block.is_practice) {
      text("Practice round!", width / 2, 5*height/8 + 40);
    }
    fill('black');
    text("Fire to start", width / 2, 5*height/8 + 80);
  } else if (gameMode == COMPLETE_MODE) {
    text("EXPERIMENT COMPLETE", width / 2, height / 2);
    fill('black');
    textSize(32);
    text("Thank you!", width / 2, 5*height/8 + 0);
  } else {
    console.log("Invalid gameMode");
  }

  if (gameMode != COMPLETE_MODE) {
    if (E.params.debug) {
      text("'N' for next game", width / 2, 5*height/8 + 80);
      text("'R' to restart current game", width / 2, 5*height/8 + 120);
      text("'S' to save game data", width / 2, 5*height/8 + 160);
    }
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
  text("Score: " + trial_block.score, width - 20, 5);

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

// ====== Firing control ======
function keyPressed(event) {
  let eventMsg;
  if (gameMode == PLAY_MODE) {
    if (key >= '1' && key <= String(E.params.nactions)) {
      // fire projectile
      let action = int(key);
      if (projectiles.length < E.params.MAX_PROJECTILES) {
        if (trial.canFireAgain == undefined) {
          eventMsg = 'projectile fired ' + key;
          projectiles.push(new Projectile(jet.x, jet.y - 30, action));
          trial.trigger({name: 'projectile onset', index: action});
          trial.canFireAgain = false;
        }
      }
    } else if (key === 'p') {
      // pause game
      eventMsg = 'pause';
      gameMode = PAUSE_MODE;
    }
  } else if (key === 'p' || key === '1') {
    // unpause game
    eventMsg = 'unpause';
    gameMode = PLAY_MODE;
  } else if (key === 'n' && gameMode != COMPLETE_MODE) {
    // start new game
    eventMsg = 'new game';
    newGame(false);
  } else if (key === 'r') {
    eventMsg = 'restart game';
    newGame(true);
  } else if (key === 's') {
    saveTrials();
  }
  logger.log(event, event.timeStamp, eventMsg);
}

function isPressingLeft() {
  if (keyIsDown(LEFT_ARROW)) return true;
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

function getRenderInfo() {
  return {
    width: width,
    height: height,
    photodiode: photodiode,
    framesInGame: framesInGame,
    jetSpeed: jetSpeed,
    driftSpeed: driftSpeed,
    cueWidth: cueWidth,
  };
}

function saveTrials() {
  logger.data.renderInfo = getRenderInfo();
  logger.data.trial_blocks = trial_blocks;
  logger.download();
}
