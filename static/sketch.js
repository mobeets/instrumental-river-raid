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
let baseCueWidth;
let immobileMode = false;
let showAnswers = true; // show number on block instead of color
let mustHitLocation = false;
let showProjectileIdentity = false;
let jet;
let trees = [];
let boats = [];
let projectiles = [];
let projectiles_test = [];
let explosions = [];
let animations = [];
let riverWidth, riverX;
let streakbar; // number of hits in a row
let lives = L;
let BOAT_COLORS = []; // filled later in setup()
let boatCounter = 0;
let explosionDuration;

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

function newGame(restartGame = false, goBack = false) {
  trial_block = E.next_block(restartGame, goBack);
  if (trial_block === undefined) { gameMode = COMPLETE_MODE; return; }
  spriteSheet = spriteSheets[trial_block.theme];

  gameMode = READY_MODE;

  if (trial_block.scene === 'grass') {
    grass.img = grassImg;
    jet.img = jetImg1;
  } else {
    grass.img = riverImg;
    jet.img = jetImg2;
  }

  showProjectileIdentity = E.params.projectileShowsNumber;
  cueWidth = baseCueWidth;

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
    showProjectileIdentity = false;
    cueWidth = E.params.nactions * baseCueWidth;
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
  baseCueWidth = cueWidth;
  driftSpeed = (height-jetOffset) / (E.params.FPS * E.params.ISI_DURATION);
  jetSpeed = (width-cueWidth) / (E.params.FPS * E.params.JET_SIDETOSIDE_DURATION);
  explosionDuration = Math.ceil(E.params.FPS * E.params.FEEDBACK_DURATION);
  
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

function getEventNameWithLocations(eventName, jet, boats, extra_info) {
  let info = {
    name: eventName,
    positions: {
      agent: {x: jet.x, y: jet.y},
      cues: []
    }
  };

  for (var i = boats.length - 1; i >= 0; i--) {
    let cue = {index: boats[i].index, x: boats[i].x, y: boats[i].y, width: boats[i].width, height: boats[i].height};
    info.positions.cues.push(cue);
  }
  if (extra_info !== undefined) Object.assign(info, extra_info);
  return info;
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
    let iti_p = 1/(E.params.ITI_MEAN_DURATION*E.params.FPS);
    if (explosions.length === 0 && boats.length < E.params.MAX_BOATS && random(1) < iti_p) {
      trial = trial_block.next_trial();
      if (trial === undefined) {
        newGame(false);
      } else {
        let nTilesPerCue = mustHitLocation ? E.params.nactions : 1;
        let boat = new Boat(boatCounter, trial.cue-1, random(riverX + cueWidth/2, riverX + riverWidth - cueWidth/2), -cueWidth, nTilesPerCue);
        boatCounter++;
        trial.trigger(getEventNameWithLocations('cue created', jet, [boat]));
        boats.push(boat);
      }
    }

    // Update and render boats
    for (let i = boats.length - 1; i >= 0; i--) {
      boats[i].update();

      if (!boats[i].hasBeenSeen && boats[i].onscreen()) {
        trial.trigger(getEventNameWithLocations('cue onset', jet, [boats[i]]));
        // markEvent triggers photodiode/sound
        markEvent();
      }
      if (boats[i].collidesWithJet(jet)) {
        // Collided with jet
        if (!immobileMode) {
          trial.trigger(getEventNameWithLocations('cue offset - collision', jet, [boats[i]]));
          boats.splice(i, 1);
          jet.takeHit();
          streakbar.reset();
          
          explosions.push(new Explosion(jet.x, jet.x, jet.y-jet.height, [255, 150, 0], explosionDuration));
          
          lives--;
        }
      } else if (boats[i].offscreen()) {
        // trial ends without a hit
        trial.trigger(getEventNameWithLocations('cue offset - offscreen', jet, [boats[i]]));
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
          trial.trigger(getEventNameWithLocations('cue offset - hit', jet, [boats[j]]));
          trial_block.score++;

          if (E.params.showHUD) streakbar.hit();
          let dx = boats[j].width/2;
          let cy = boats[j].y - boats[j].height/3;
          explosions.push(new Explosion(boats[j].x - dx, boats[j].x + dx, cy, [255, 150, 0], explosionDuration));
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
        trial.trigger(getEventNameWithLocations('projectile offset - miss', jet, boats, {action_index: p.action}));
        projectiles.splice(i, 1);
      }
    }

    // Update jet
    jet.update();
    if (trial !== undefined) trial.logPositions(jet, boats, projectiles);
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

function showImages(yOffset) {
  imageMode(CENTER);
  rectMode(CENTER);
  // let size = 0.5*cueWidth;
  let size = min(cueWidth, 0.9*width / 6, 0.2*height);
  let total_size = trial_block.ncues * 1.1 * size;
  let baseX = width / 2 - total_size / 2 + size / 2;
  push();
  // translate(width / 2 - total_size / 2 + size / 2, height - size);
  translate(baseX, yOffset);
  let nTilesPerCue = mustHitLocation ? E.params.nactions : 1;

  let x = 0;
  let y = 0;
  for (var cue = 0; cue < trial_block.ncues; cue++) {
    let color = BOAT_COLORS[cue];
    let xc = x + 1.1*size*cue;
    fill(color);
    if (nTilesPerCue === 1) {
      rect(xc, y, size, size);
    } else {
      rect(xc, y, size, size/nTilesPerCue);
    }

    if (spriteSheet === undefined) {
      fill('black'); noStroke();
      let circleDiam = size / 5;
      if (cue+1 === 1 || cue+1 === 3) {
        ellipse(xc, y, circleDiam);
        if (cue+1 === 3) {
          ellipse(xc-1.5*circleDiam, y, circleDiam);
          ellipse(xc+1.5*circleDiam, y, circleDiam);
        }
      } else {
        ellipse(xc-0.75*circleDiam, y, circleDiam);
        ellipse(xc+0.75*circleDiam, y, circleDiam);
      }
    } else {
      let img = spriteSheet.getImage(trial_block.theme_offset + cue);
      if (nTilesPerCue === 1) {
        image(img, xc, y, size, size);
      } else {
        let csz = size/nTilesPerCue;
        image(img, xc - csz, y, csz, csz);
        image(img, xc, y, csz, csz);
        image(img, xc + csz, y, csz, csz);
        stroke('black'); strokeWeight(1); noFill();
        rect(xc, y, csz, csz);
        let jet_x = jet.x - baseX;

        let xs = [-csz, 0, csz];
        for (var i = 0; i < xs.length; i++) {
          let x1 = xc + xs[i] - csz/2;
          let x2 = xc + xs[i] + csz/2;
          if (jet_x >= x1 && jet_x <= x2) {
            strokeWeight(5);
            rect(xc + xs[i], y, csz, csz);
          }
        }
      }
      stroke('black');
      strokeWeight(1); 
      noFill();
      if (nTilesPerCue === 1) {
        rect(xc, y, size, size);
      } else {
        rect(xc, y, size, size/nTilesPerCue);
      }
    }
  }
  pop();
  noStroke();
}

function showJet() {
  jet.update();
  jet.render();
  for (let i = projectiles_test.length - 1; i >= 0; i--) {
    let p = projectiles_test[i];
    p.update();
    p.render();
    if (p.y < jet.y - 100) projectiles_test.splice(i, 1);
  }
  let action = user.fired;
  if (action > 0) {
    if (projectiles_test.length < E.params.MAX_PROJECTILES) {
      projectiles_test.push(new Projectile(jet.x, jet.y - 30, action, showProjectileIdentity));
    }
  }
}

function showInstructions(yOffset) {

  textSize(20);
  fill('black');
  text("Instructions:", width / 2, yOffset);
  textFont('arial');
  fill('black');
  text(trial_block.instructions, width / 2, yOffset + 40);
  textFont(myFont);
}

function drawPauseScreen() {
  textSize(48);
  fill('black');
  textAlign(CENTER, CENTER);
  textFont(myFont);

  let firstLineY = 2 * height / 9;
  let secondLineY = 3 * height / 9;

  if (gameMode == PAUSE_MODE) {
    text("PAUSED", width / 2, firstLineY);
    if (trial_block.instructions) {
      showInstructions(secondLineY + 100);
      showImages(secondLineY + 300);
    }
  } else if (gameMode == STARTING_MODE) {
    text("GAME COMPLETE", width / 2, firstLineY);

    fill('black');
    textSize(32);
    text("Game " + (E.block_index+1).toFixed(0) + " of " + E.block_configs.length.toFixed(0), width / 2, secondLineY + 0);
    text("Score: " + trial_block.score.toFixed(0) + " out of " + trial_block.trials.length, width / 2, secondLineY + 40);
  } else if (gameMode == READY_MODE) {
    if (trial_block.block_count === 0) {
      fill('black');
      text("Welcome!", width / 2, firstLineY);
    } else {
      text("Great job!", width / 2, firstLineY);
    }
    fill('black');
    textSize(32);
    text("Game " + (E.block_index+1).toFixed(0) + " of " + E.block_configs.length.toFixed(0), width / 2, secondLineY + 0);
    if (trial_block.is_practice) {
      fill('#9e442f');
      text("Practice round!", width / 2, secondLineY + 40);
      showJet();
    }
    if (trial_block.instructions) {
      showInstructions(secondLineY + 100);
      showImages(secondLineY + 300);
    }
    textSize(32);
    fill('black');
    // text("Fire to start", width / 2, 4*height/8 + 80);
  } else if (gameMode == COMPLETE_MODE) {
    text("EXPERIMENT COMPLETE", width / 2, firstLineY);
    fill('black');
    textSize(32);
    text("Thank you!", width / 2, secondLineY + 0);
  } else {
    console.log("Invalid gameMode");
  }

  if (gameMode != COMPLETE_MODE) {
    if (E.params.debug) {
      text("'N' for next game", width / 2, secondLineY + 80);
      text("'R' to restart current game", width / 2, secondLineY + 120);
      text("'S' to save game data", width / 2, secondLineY + 160);
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
        if (trial !== undefined && boats.length > 0 && boats[0].hasBeenSeen && trial?.canFireAgain === undefined) {
          eventMsg = 'projectile fired ' + action.toFixed(0);
          projectiles.push(new Projectile(jet.x, jet.y - 30, action, showProjectileIdentity));
          if (mustHitLocation && boats.length > 0) boats[0].setSelectedLocationIndex(jet.x);

          trial.trigger(getEventNameWithLocations('projectile onset', jet, boats, {action_index: action}));
          trial.canFireAgain = false;
        }
      }
    }
    if (user.pause) {
      // pause game
      eventMsg = 'pause';
      gameMode = PAUSE_MODE;
    }
  } else if (user.pause) {
    // unpause game
    eventMsg = 'unpause';
    gameMode = PLAY_MODE;
  } else if (user.next_block && gameMode != COMPLETE_MODE) {
    // go to the next block
    eventMsg = 'new game (going to next block)';
    newGame(false);
  } else if (user.back_block && gameMode != COMPLETE_MODE) {
    // go back a block
    eventMsg = 'new game (going back a block)';
    newGame(false, true);
  } else if (user.restart_block) {
    eventMsg = 'restart block';
    newGame(true);
  } else if (user.save) {
    manuallySaveToJSON(E);
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
    boatColors: BOAT_COLORS,
    explosionDuration: explosionDuration
  };
}
