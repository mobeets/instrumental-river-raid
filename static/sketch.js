// ===== Data settings =====
let config;
let E;
let trial_blocks = [];
let trial_block;
let trial;
let photodiode;
let controls;
let user;
let clickSound;

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
let mustHitLocation = false;
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
let spriteSheets = {};
function preload() {
  clickSound = new Audio('assets/click.mp3');
  myFont = loadFont('assets/LuckiestGuy-Regular.ttf');
  riverImg = loadImage('assets/river.png');
  jetImg1 = loadImage('assets/jet1.png');
  jetImg2 = loadImage('assets/jet2.png');
  grassImg = loadImage('assets/grass.png');
  // stoneImg = loadImage('assets/stone.png');
  spriteSheets.animals_1 = new SquareSpriteSheet('assets/themes/animals_1.png', 64);
  spriteSheets.animals_2 = new SquareSpriteSheet('assets/themes/animals_2.png', 64);
  spriteSheets.flowers_food = new SquareSpriteSheet('assets/themes/flowers_food.png', 64);
  spriteSheets.animals_land = new SquareSpriteSheet('assets/themes/animals_land.png', 64);
  spriteSheets.training = new SquareSpriteSheet('assets/themes/training.png', 64);
  config = loadConfig();
}

function newGame(restartGame = false) {
  trial_block = E.next_block(restartGame);
  if (trial_block === undefined) { gameMode = COMPLETE_MODE; return; }
  spriteSheet = spriteSheets[trial_block.theme];

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
    mustHitLocation = false;
  } else if (trial_block.name === "instrumental") {
    immobileMode = true;
    showAnswers = false;
    mustHitLocation = false;
  } else if (trial_block.name === "targets-instrumental") {
    immobileMode = false;
    showAnswers = false;
    mustHitLocation = false;
  } else if (trial_block.name === "locations-instrumental") {
    immobileMode = false;
    showAnswers = false;
    mustHitLocation = true;
  } else {
    console.log("Invalid game type.");
  }
  trial_blocks.push(trial_block);

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

  photodiode = new Photodiode(E.params.photodiode, width, height);
  controls = new UnifiedControls(wsLogger);
  user = new TaskControls(controls);
  
  // set drift speed to maintain fixed scroll times
  let jetOffset = E.params.jetOffset;
  cueWidth = width*E.params.PROP_CUE_WIDTH;
  driftSpeed = (height-jetOffset) / (E.params.FPS * E.params.SCROLL_TIME);
  jetSpeed = (width-cueWidth) / (E.params.FPS * 1.5);
  
  let nonPhotodiodeProp = 1 - 2*photodiode.size / width;
  // n.b. if E.params.PROP_RIVER_WIDTH < nonPhotodiodeProp, the photodiode will block the view of some Boat objects

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
  
  // log config and render info
  E.renderInfo = getRenderInfo();
  E.log();

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
  controls.update();
  checkUserButtonPresses();

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
        let nTilesPerCue = mustHitLocation ? E.params.nactions : 1;
        boats.push(new Boat(trial.cue-1, random(riverX + cueWidth/2, riverX + riverWidth - cueWidth/2), -cueWidth, nTilesPerCue));
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
        if (boats[j].checkHit(p, mustHitLocation)) {
          // Correct hit
          trial.trigger('hit');
          trial.trigger('cue offset');
          trial_block.score++;

          if (E.params.showHUD) streakbar.hit();
          let dx = boats[j].width/2;
          let cy = boats[j].y;// - boats[j].height/2;
          explosions.push(new Explosion(boats[j].x - dx, boats[j].x + dx, cy, [255, 150, 0]));
          boats.splice(j, 1);
          projectiles.splice(i, 1);
          break;
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
    text("Score: " + trial_block.score.toFixed(0) + " out of " + trial_block.trials.length, width / 2, 5*height/8 + 40);
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

function checkUserButtonPresses() {
  let eventMsg;
  if (gameMode == PLAY_MODE) {
    let action = user.fired;
    if (action > 0) {
      if (projectiles.length < E.params.MAX_PROJECTILES) {
        if (trial !== undefined && trial?.canFireAgain === undefined) {
          eventMsg = 'projectile fired ' + action.toFixed(0);
          projectiles.push(new Projectile(jet.x, jet.y - 30, action));
          if (mustHitLocation && boats.length > 0) boats[0].setSelectedLocationIndex(jet.x);
          trial.trigger({name: 'projectile onset', index: action});
          trial.canFireAgain = false;
        }
      }
    }
    if (user.pause) {
      // pause game
      eventMsg = 'pause';
      gameMode = PAUSE_MODE;
    }
  } else if (user.pause || user.fired > 0) {
    // unpause game
    eventMsg = 'unpause';
    gameMode = PLAY_MODE;
  } else if (user.next_block && gameMode != COMPLETE_MODE) {
    // start new game
    eventMsg = 'new game';
    newGame(false);
  } else if (user.restart_block) {
    eventMsg = 'restart game';
    newGame(true);
  }
  if (eventMsg !== undefined) {
    wsLogger.log("interaction", {eventMsg});
  }
}

// for discrete events that we want to timestamp
function markEvent() {
  photodiode.trigger(50);
  clickSound.play();
}

// hook up to universal controls
function keyPressed(event) { controls.keyPressed(event); }
function keyReleased(event) { controls.keyReleased(event); }
function mousePressed(event) { controls.mousePressed(event); }
function mouseReleased(event) { controls.mouseReleased(event); }

function getRenderInfo() {
  return {
    width: width,
    height: height,
    photodiode: photodiode,
    jetSpeed: jetSpeed,
    driftSpeed: driftSpeed,
    cueWidth: cueWidth,
  };
}
