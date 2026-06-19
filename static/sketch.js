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
let spriteSize = 128;
let L = 5; // starting lives
let streakBarMax = 5; // required streak for point bonus
let streakBonus = 10; // points for filling streak bar
let framesInGame = 0;
let R; // reward matrix
let driftSpeed; // will be set to ensure fixed travel time from top to bottom
let baseDriftSpeed;
let practiceDriftSpeed;
let jetSpeed; // will be set to allow fixed travel time from left to right
let projectileSpeed;
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
let iti2MinTimer = 0; // timer to implement minimum time for ITI2
let iti1MinTimer = 0; // timer to implement minimum time for ITI1, that way ITI 1 doesn't start until the feedback period is over
let trialActive = false;

const PLAY_MODE = 0;
const PAUSE_MODE = 1;
const STARTING_MODE = 2;
const READY_MODE = 3;
const COMPLETE_MODE = 4;
let gameMode = READY_MODE;
let feedbackTimer = 0; // counts down frames to show feedback text

// ===== Assets =====

let myFont;
let riverImg;
let jetImg;
let grassImg;
let stoneImg;
let spriteSheet;
let spriteSheets = {};
function preload() {
  clickSound = new Audio("assets/click.mp3");
  myFont = loadFont("assets/LuckiestGuy-Regular.ttf");
  riverImg = loadImage("assets/river.png");
  jetImg1 = loadImage("assets/jet1.png");
  jetImg2 = loadImage("assets/jet2.png");
  grassImg = loadImage("assets/grass.png");
  // stoneImg = loadImage('assets/stone.png');
  spriteSheets.villains_1 = new SquareSpriteSheet(
    "assets/themes/villains_1.png",
    spriteSize,
  );
  spriteSheets.villains_2 = new SquareSpriteSheet(
    "assets/themes/villains_2.png",
    spriteSize,
  );
  spriteSheets.villains_3 = new SquareSpriteSheet(
    "assets/themes/villains_3.png",
    spriteSize,
  );
  spriteSheets.villains_4 = new SquareSpriteSheet(
    "assets/themes/villains_4.png",
    spriteSize,
  );
  spriteSheets.animals_1 = new SquareSpriteSheet(
    "assets/themes/animals_1.png",
    spriteSize,
  );
  spriteSheets.animals_2 = new SquareSpriteSheet(
    "assets/themes/animals_2.png",
    spriteSize,
  );
  spriteSheets.flowers_food = new SquareSpriteSheet(
    "assets/themes/flowers_food.png",
    spriteSize,
  );
  spriteSheets.animals_land = new SquareSpriteSheet(
    "assets/themes/animals_land.png",
    spriteSize,
  );
  spriteSheets.training = new SquareSpriteSheet(
    "assets/themes/training.png",
    spriteSize,
  );
  spriteSheets.animal_cartoons = new SquareSpriteSheet(
    "assets/themes/animal_cartoons.png",
    spriteSize,
  );
  spriteSheets.animals_4 = new SquareSpriteSheet(
    "assets/themes/animals_4.png",
    spriteSize,
  );
  spriteSheets.faces = new SquareSpriteSheet(
    "assets/themes/faces.png",
    spriteSize,
  );
  spriteSheets.toys = new SquareSpriteSheet(
    "assets/themes/toys.png",
    spriteSize,
  );
  spriteSheets.fractal = new SquareSpriteSheet(
    "assets/themes/fractal.png",
    spriteSize,
  );
  spriteSheets.abstract_1 = new SquareSpriteSheet(
    "assets/themes/abstract_1.png",
    spriteSize,
  );
  spriteSheets.abstract_2 = new SquareSpriteSheet(
    "assets/themes/abstract_2.png",
    spriteSize,
  );
  spriteSheets.abstract_3 = new SquareSpriteSheet(
    "assets/themes/abstract_3.png",
    spriteSize,
  );
  spriteSheets.abstract_4 = new SquareSpriteSheet(
    "assets/themes/abstract_4.png",
    spriteSize,
  );
  spriteSheets.abstract_1_v1 = new SquareSpriteSheet(
    "assets/themes/abstract_1_v1.png",
    spriteSize,
  );
  spriteSheets.abstract_1_v2 = new SquareSpriteSheet(
    "assets/themes/abstract_1_v2.png",
    spriteSize,
  );
  spriteSheets.abstract_1_v3 = new SquareSpriteSheet(
    "assets/themes/abstract_1_v3.png",
    spriteSize,
  );
  spriteSheets.abstract_2_v1 = new SquareSpriteSheet(
    "assets/themes/abstract_2_v1.png",
    spriteSize,
  );
  spriteSheets.abstract_2_v2 = new SquareSpriteSheet(
    "assets/themes/abstract_2_v2.png",
    spriteSize,
  );
  spriteSheets.abstract_2_v3 = new SquareSpriteSheet(
    "assets/themes/abstract_2_v3.png",
    spriteSize,
  );
  spriteSheets.abstract_3_v1 = new SquareSpriteSheet(
    "assets/themes/abstract_3_v1.png",
    spriteSize,
  );
  spriteSheets.abstract_3_v2 = new SquareSpriteSheet(
    "assets/themes/abstract_3_v2.png",
    spriteSize,
  );
  spriteSheets.abstract_3_v3 = new SquareSpriteSheet(
    "assets/themes/abstract_3_v3.png",
    spriteSize,
  );
  spriteSheets.abstract_4_v1 = new SquareSpriteSheet(
    "assets/themes/abstract_4_v1.png",
    spriteSize,
  );
  spriteSheets.abstract_4_v2 = new SquareSpriteSheet(
    "assets/themes/abstract_4_v2.png",
    spriteSize,
  );
  spriteSheets.abstract_4_v3 = new SquareSpriteSheet(
    "assets/themes/abstract_4_v3.png",
    spriteSize,
  );
  config = loadConfig();
}

function newGame(restartGame = false, goBack = false) {
  trial_block = E.next_block(restartGame, goBack);
  if (trial_block === undefined) {
    gameMode = COMPLETE_MODE;
    return;
  }
  spriteSheet = spriteSheets[trial_block.theme];

  gameMode = READY_MODE;

  if (trial_block.scene === "grass") {
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
    showAnswers = false;
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
    cueWidth = (2 / 3) * E.params.nactions * baseCueWidth;
  } else if (trial_block.name === "locations") {
    immobileMode = false;
    showAnswers = true;
    mustHitLocation = true;
    showProjectileIdentity = false;
    cueWidth = (2 / 3) * E.params.nactions * baseCueWidth;
  } else {
    console.log("Invalid game type.");
  }
  if (trial_block.is_practice) {
    driftSpeed = practiceDriftSpeed;
  } else {
    driftSpeed = baseDriftSpeed;
  }
  trial_block.setTrialOrder();
  trial_blocks.push(trial_block);

  framesInGame = 0;
  lives = L;
  if (E.params.showHUD) streakbar.reset();
  boats = [];
  projectiles = [];
  explosions = [];
  animations = [];
  jet.visible = false; // reset jet visibility for new block
  trialActive = false; // reset trial for new block
  iti1MinTimer = 0;
}

// ====== p5.js setup and draw ======
function setup() {
  E = new Experiment(config);

  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent("canvas-container"); // attach to the centered div

  photodiode = new Photodiode(E.params.photodiode, width, height);
  controls = new UnifiedControls(wsLogger);
  user = new TaskControls(controls);

  // set drift speed to maintain fixed scroll times
  let jetOffset = E.params.jetOffset;
  cueWidth = width * E.params.PROP_CUE_WIDTH;
  baseCueWidth = cueWidth;
  driftSpeed = (height - jetOffset) / (E.params.FPS * E.params.ISI_DURATION);
  baseDriftSpeed = driftSpeed;
  practiceDriftSpeed =
    (height - jetOffset) / (E.params.FPS * E.params.PRACTICE_ISI_DURATION);
  jetSpeed =
    (width - cueWidth) / (E.params.FPS * E.params.JET_SIDETOSIDE_DURATION);
  projectileSpeed =
    (height - jetOffset) / (E.params.FPS * E.params.PROJECTILE_TRAVEL_DURATION);
  explosionDuration = Math.ceil(E.params.FPS * E.params.FEEDBACK_DURATION);

  let nonPhotodiodeProp = 1 - (2 * photodiode.size) / width;
  // n.b. if E.params.PROP_RIVER_WIDTH < nonPhotodiodeProp, the photodiode will block the view of some Boat objects

  grass = new Grass(grassImg, E.params.PROP_RIVER_WIDTH);

  // Define boat colors here (p5 color() now available)
  BOAT_COLORS = [
    color(255, 0, 0),
    color(0, 0, 255),
    color(255, 255, 0),
    color(0, 255, 255),
    color(255, 0, 255),
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
      agent: { x: jet.x, y: jet.y },
      cues: [],
    },
  };

  for (var i = boats.length - 1; i >= 0; i--) {
    let cue = {
      index: boats[i].index,
      x: boats[i].x,
      y: boats[i].y,
      width: boats[i].width,
      height: boats[i].height,
    };
    info.positions.cues.push(cue);
  }
  if (extra_info !== undefined) Object.assign(info, extra_info);
  return info;
}

function draw() {
  frameRate(E.params.FPS);
  if (gameMode == PLAY_MODE) {
    background("#496FB6");
  } else {
    if (gameMode == READY_MODE) {
      let taskBg =
        {
          targets: "#FFF9C4",
          instrumental: "#BBDEFB",
          "targets-instrumental": "#C8E6C9",
        }[trial_block.name] || "gray";
      background(taskBg);
    } else {
      background("gray");
    }
  }
  controls.update();
  checkUserButtonPresses();

  if (gameMode == PLAY_MODE) {
    framesInGame++;
    grass.update();

    // ITI 1 — jet appears after previous trial ends
    let iti_p = 1 / (E.params.ITI_MEAN_DURATION * E.params.FPS);
    if (iti1MinTimer > 0) iti1MinTimer--;
    if (
      explosions.length === 0 &&
      boats.length === 0 &&
      !jet.visible &&
      iti1MinTimer === 0 &&
      random(1) < iti_p
    ) {
      trial = trial_block.next_trial();
      if (trial === undefined) {
        newGame(false);
      } else {
        let curX = trial_block.cue_locations[trial.location_index];
        if (trial_block.name === "instrumental") {
          jet.x = curX;
        } else {
          let jetX;
          do {
            jetX = riverX + random(cueWidth / 2, riverWidth - cueWidth / 2);
          } while (abs(jetX - curX) < cueWidth / 2 + jet.width / 2);
          jet.x = jetX;
        }
        jet.visible = true; // add some kind of signal to logger
        trialActive = true; // add boolean to ensure that trial is active
        trial.trigger(getEventNameWithLocations("agent onset", jet, []));
        iti2MinTimer = Math.ceil(E.params.ITI2_MIN_DURATION * E.params.FPS); // adds at least 0.25 second after plane appears
        return; // ← skip ITI 2 this frame
      }
    }

    // ITI 2 — boat appears after jet has been visible for a bit
    let iti2_p = 1 / (E.params.ITI2_MEAN_DURATION * E.params.FPS);

    if (iti2MinTimer > 0) iti2MinTimer--;
    if (
      explosions.length === 0 &&
      boats.length === 0 &&
      jet.visible &&
      trialActive &&
      iti2MinTimer === 0 &&
      random(1) < iti2_p
    ) {
      let nTilesPerCue = mustHitLocation ? E.params.nactions : 1;
      let curX = trial_block.cue_locations[trial.location_index];
      let boat = new Boat(
        boatCounter,
        trial.cue - 1,
        curX,
        cueWidth / 2,
        nTilesPerCue,
      );
      boat.jetAligned = false;
      boat.firedDuringTrial = false;
      boat.correctButtonFired = false;
      boat.wasEverAligned = false;
      boat.firstAlignTime = false;
      boatCounter++;
      trial.trigger(getEventNameWithLocations("cue created", jet, [boat])); // similar to this
      boats.push(boat);
    }

    // Update and render boats
    for (let i = boats.length - 1; i >= 0; i--) {
      boats[i].update();
      // proximity-based explosion for targets task
      if (trial_block.name === "targets" && boats[i].shouldExplode) {
        trial.trigger(
          getEventNameWithLocations("cue offset - hit", jet, [boats[i]]),
        );
        trial_block.score++;
        if (E.params.showHUD) streakbar.hit();
        let dx = boats[i].width / 2;
        let cy = boats[i].y - boats[i].height / 3;
        explosions.push(
          new Explosion(
            boats[i].x - dx,
            boats[i].x + dx,
            cy,
            [255, 150, 0],
            explosionDuration,
          ),
        );
        boats.splice(i, 1);
        jet.visible = false; // ← add
        // removed trial = undefined;     // ← add
        trialActive = false;
        iti1MinTimer = explosionDuration;
        feedbackTimer = explosionDuration;
        continue;
      }

      if (!boats[i].hasBeenSeen && boats[i].onscreen()) {
        trial.trigger(getEventNameWithLocations("cue onset", jet, [boats[i]]));
        // markEvent triggers photodiode/sound
        markEvent();
      }
      let horizontalOverlap =
        jet.x + jet.width / 2 > boats[i].x - boats[i].width / 2 &&
        jet.x - jet.width / 2 < boats[i].x + boats[i].width / 2;
      if (
        horizontalOverlap &&
        (trial_block.name === "targets-instrumental" ||
          trial_block.name === "targets")
      ) {
        boats[i].jetAligned = true;
        boats[i].wasEverAligned = true;
        if (!boats[i].firstAlignTime) {
          boats[i].firstAlignTime = true;
          trial.trigger(
            getEventNameWithLocations("position match", jet, [boats[i]]), // for reaction time of T (position is aligned with cue)
          );
        }
      }

      let boatBottomY = boats[i].y + boats[i].height / 2;
      let jetTopY = jet.y - jet.height / 2;
      let jetBottomY = jet.y + jet.height / 2;
      let boatReachedJet = boatBottomY >= jetTopY && boatBottomY <= jetBottomY;

      if (
        E.params["target-variant"] &&
        trial_block.name === "targets" &&
        horizontalOverlap &&
        boatReachedJet
      ) {
        trial.trigger(
          getEventNameWithLocations("cue offset - hit", jet, [boats[i]]),
        );
        trial_block.score++;
        if (E.params.showHUD) streakbar.hit();
        let dx = boats[i].width / 2;
        let cy = boats[i].y - boats[i].height / 3;
        explosions.push(
          new Explosion(
            boats[i].x - dx,
            boats[i].x + dx,
            cy,
            [255, 150, 0],
            explosionDuration,
          ),
        );
        boats.splice(i, 1);
        jet.visible = false;
        // removed: trial = undefined;
        trialActive = false;
        iti1MinTimer = explosionDuration;
        feedbackTimer = explosionDuration;
        continue;
      } else if (boats[i].offscreen()) {
        let offscreenName;
        if (trial_block.name === "targets") {
          offscreenName = boats[i].wasEverAligned
            ? "cue offset - offscreen - too late"
            : "cue offset - offscreen - wrong position";
        } else if (trial_block.name === "targets-instrumental") {
          if (!boats[i].jetAligned && !boats[i].firedDuringTrial) {
            offscreenName = "cue offset - offscreen - wrong position, no fire";
          } else if (boats[i].jetAligned && !boats[i].firedDuringTrial) {
            offscreenName = "cue offset - offscreen - right position, no fire";
          } else if (
            boats[i].firedDuringTrial &&
            !boats[i].correctButtonFired
          ) {
            offscreenName =
              "cue offset - offscreen - right position, wrong button";
          } else if (
            boats[i].firedDuringTrial &&
            boats[i].correctButtonFired &&
            !boats[i].jetAligned
          ) {
            offscreenName =
              "cue offset - offscreen - wrong position, right button";
          } else {
            offscreenName = "cue offset - offscreen";
          }
        } else {
          offscreenName = "cue offset - offscreen";
        }
        trial.trigger(
          getEventNameWithLocations(offscreenName, jet, [boats[i]]),
        );
        jet.visible = false;
        // removed trial = undefined;
        trialActive = false;
        iti1MinTimer = 0;
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
          trial.trigger(
            getEventNameWithLocations("cue offset - hit", jet, [boats[j]]),
          );
          trial_block.score++;

          if (E.params.showHUD) streakbar.hit();
          let dx = boats[j].width / 2;
          let cy = boats[j].y - boats[j].height / 3;
          explosions.push(
            new Explosion(
              boats[j].x - dx,
              boats[j].x + dx,
              cy,
              [255, 150, 0],
              explosionDuration,
            ),
          );
          jet.visible = false;
          trialActive = false;
          iti1MinTimer = explosionDuration;
          boats.splice(j, 1);
          projectiles.splice(i, 1);
          feedbackTimer = explosionDuration;
          break;
        } else if (
          !E.params.bulletsPassThru &&
          p.y < boats[j].y - boats[j].height / 2
        ) {
          // bullet is incorrect, so we make it disappear
          pIsAboveBoat = true;
        }
      }

      if (pIsAboveBoat || p.offscreen()) {
        if (E.params.showHUD) streakbar.reset();
        if (trialActive)
          trial.trigger(
            getEventNameWithLocations("projectile offset - miss", jet, boats, {
              action_index: p.action,
            }),
          );
        projectiles.splice(i, 1);
      }
    }

    // Update jet
    jet.update();
    if (trialActive) trial.logPositions(jet, boats, projectiles);
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

  // Display feedback
  if (gameMode == PLAY_MODE) {
    if (feedbackTimer > 0) {
      feedbackTimer--;
      fill("white");
      textSize(64);
      textAlign(CENTER, CENTER);
      textFont(myFont);
      text("Great!", width / 2, height / 2);
      if (feedbackTimer === 0) {
        if (trialActive)
          trial.trigger(getEventNameWithLocations("feedback offset", jet, []));
      }
    }
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
  let size = min(cueWidth, (0.9 * width) / 6, 0.2 * height);
  let total_size = trial_block.ncues * 1.1 * size;
  let baseX = width / 2 - total_size / 2 + size / 2;
  push();
  // translate(width / 2 - total_size / 2 + size / 2, height - size);
  translate(baseX, yOffset);
  let nTilesPerCue = mustHitLocation ? E.params.nactions : 1;

  let x = 0;
  let y = 0;
  for (var cue = 0; cue < trial_block.ncues; cue++) {
    let img, color;
    if (spriteSheet === undefined) {
      color = trial_block.cue_colors[cue];
    } else {
      color = "#ccc";
      img = spriteSheet.getImage(trial_block.theme_offset + cue);
    }

    let xc = x + 1.1 * size * cue;
    fill(color);
    noStroke();
    if (nTilesPerCue === 1) {
      rect(xc, y, size, size);
    } else {
      rect(xc, y, size, size / nTilesPerCue);
    }

    if (spriteSheet === undefined) {
      fill("black");
      noStroke();
      // let action_index = cue;
      let action_index = -1;
      let row = trial_block.R[cue];
      for (let i = 0; i < row.length; i++) {
        if (row[i] > 0) {
          action_index = i;
        }
      }
      let csz = size / nTilesPerCue;
      let circleDiam = csz / 5;

      if (nTilesPerCue === 1) {
        let xd = xc;
        if (action_index + 1 === 1 || action_index + 1 === 3) {
          ellipse(xd, y, circleDiam);
          if (action_index + 1 === 3) {
            ellipse(xd - 1.5 * circleDiam, y, circleDiam);
            ellipse(xd + 1.5 * circleDiam, y, circleDiam);
          }
        } else {
          ellipse(xd - 0.75 * circleDiam, y, circleDiam);
          ellipse(xd + 0.75 * circleDiam, y, circleDiam);
        }
      } else {
        let xs = [-csz, 0, csz];
        fill("black");
        noStroke();

        stroke("black");
        strokeWeight(1);
        noFill();
        rect(xc, y, csz, csz);
        rect(xc, y, nTilesPerCue * csz, csz);

        let jet_x = jet.x - baseX;
        for (var i = 0; i < xs.length; i++) {
          let x1 = xc + xs[i] - csz / 2;
          let x2 = xc + xs[i] + csz / 2;
          let xd = xc + xs[i];

          if (i === action_index) {
            stroke("black");
            strokeWeight(1);
            fill("black");
            textFont("arial");
            textSize(0.5 * csz);
            text("x", xd, y);
            textFont(myFont);
          }

          if (jet_x >= x1 && jet_x <= x2) {
            stroke("white");
            strokeWeight(4);
            noFill();
            rect(xc + xs[i], y, csz, csz);
            strokeWeight(1);
          }
        }
      }
    } else {
      stroke("black");
      strokeWeight(1);
      noFill();
      if (nTilesPerCue === 1) {
        rect(xc, y, size, size);
      } else {
        rect(xc, y, size, size / nTilesPerCue);
      }

      if (nTilesPerCue === 1) {
        image(img, xc, y, size, size);
      } else {
        let csz = size / nTilesPerCue;
        image(img, xc - csz, y, csz, csz);
        image(img, xc, y, csz, csz);
        image(img, xc + csz, y, csz, csz);
        stroke("black");
        strokeWeight(1);
        noFill();
        rect(xc, y, csz, csz);

        let jet_x = jet.x - baseX;
        let xs = [-csz, 0, csz];
        for (var i = 0; i < xs.length; i++) {
          let x1 = xc + xs[i] - csz / 2;
          let x2 = xc + xs[i] + csz / 2;
          if (jet_x >= x1 && jet_x <= x2) {
            stroke("white");
            strokeWeight(4);
            rect(xc + xs[i], y, csz, csz);
          }
        }
      }
    }
  }
  pop();
  noStroke();
}

function showJet() {
  let wasVisible = jet.visible;
  jet.visible = true; // force visible for preview
  jet.update();
  jet.render();
  jet.visible = wasVisible; // ← restore original state
  for (let i = projectiles_test.length - 1; i >= 0; i--) {
    let p = projectiles_test[i];
    p.update();
    p.render();
    if (p.y < jet.y - 100) projectiles_test.splice(i, 1);
  }
  let action = user.fired;
  if (action > 0 && trial_block.name !== "targets") {
    if (projectiles_test.length < E.params.MAX_PROJECTILES) {
      projectiles_test.push(
        new Projectile(jet.x, jet.y - 30, action, showProjectileIdentity),
      );
    }
  }
}

function showInstructions(yOffset) {
  textSize(20);
  fill("black");
  text("Instructions:", width / 2, yOffset);
  textFont("arial");
  fill("black");
  text(trial_block.instructions, width / 2, yOffset + 40);
  textFont(myFont);
}

function drawPauseScreen() {
  textSize(48);
  fill("black");
  textAlign(CENTER, CENTER);
  textFont(myFont);

  let firstLineY = (2 * height) / 9;
  let secondLineY = (3 * height) / 9;

  if (gameMode == PAUSE_MODE) {
    text("PAUSED", width / 2, firstLineY);
    if (trial_block.instructions) {
      showInstructions(secondLineY + 100);
      showImages(secondLineY + 300);
    }
  } else if (gameMode == STARTING_MODE) {
    text("GAME COMPLETE", width / 2, firstLineY);

    fill("black");
    textSize(32);
    text(
      "Game " +
        (E.block_index + 1).toFixed(0) +
        " of " +
        E.block_configs.length.toFixed(0),
      width / 2,
      secondLineY + 0,
    );
    text(
      "Score: " +
        trial_block.score.toFixed(0) +
        " out of " +
        trial_block.trials.length,
      width / 2,
      secondLineY + 40,
    );
  } else if (gameMode == READY_MODE) {
    if (trial_block.block_count === 0) {
      fill("black");
      text("Welcome!", width / 2, firstLineY);
    } else {
      text("Great job!", width / 2, firstLineY);
    }
    fill("black");
    textSize(32);

    text(
      "Game " +
        (E.block_index + 1).toFixed(0) +
        " of " +
        E.block_configs.length.toFixed(0),
      width / 2,
      secondLineY + 0,
    );

    // Display task name with task-specific color
    let taskDisplayName =
      {
        targets: "Targets",
        instrumental: "Learning",
        "targets-instrumental": "Combined: Targets + Learning",
      }[trial_block.name] || trial_block.name;
    let taskColor =
      {
        targets: "#6B4A00",
        instrumental: "#1a237e",
        "targets-instrumental": "#1B5E20",
      }[trial_block.name] || "#1a5276";
    fill(taskColor);
    textSize(36);
    text(taskDisplayName, width / 2, secondLineY + 45);

    if (trial_block.is_practice) {
      fill("#9e442f");
      textSize(32);
      text("Practice round!", width / 2, secondLineY + 90);
    }
    if (trial_block.instructions) {
      showInstructions(secondLineY + 140);
      showImages(secondLineY + 340);
      showJet();
    }

    textSize(32);
    fill("black");
    // text("Fire to start", width / 2, 4*height/8 + 80);
  } else if (gameMode == COMPLETE_MODE) {
    text("EXPERIMENT COMPLETE", width / 2, firstLineY);
    fill("black");
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
  fill("black");
  rect(0, 0, width, 30);
  textSize(24);

  // Score
  textFont(myFont);
  fill(255);
  textAlign(RIGHT, TOP);
  if (streakbar.isAnimating) {
    textSize(30);
    fill("yellow");
  }
  text("Score: " + trial_block.score, width - 20, 5);

  if (!immobileMode) {
    // Show lives as hearts
    fill(255);
    textSize(24);
    textFont("Helvetica");
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
        if (
          trialActive &&
          boats.length > 0 &&
          boats[0].hasBeenSeen &&
          trial?.canFireAgain === undefined &&
          trial_block.name !== "targets"
        ) {
          eventMsg = "projectile fired " + action.toFixed(0);
          projectiles.push(
            new Projectile(jet.x, jet.y - 30, action, showProjectileIdentity),
          );
          if (mustHitLocation && boats.length > 0)
            boats[0].setSelectedLocationIndex(jet.x);

          trial.trigger(
            getEventNameWithLocations("projectile onset", jet, boats, {
              action_index: action,
            }),
          );
          trial.canFireAgain = false;
          if (boats.length > 0) {
            boats[0].firedDuringTrial = true;
            boats[0].correctButtonFired =
              action - 1 === boats[0].correctActionIndex;
          }
        }
      }
    }
    if (user.pause) {
      // pause game
      eventMsg = "pause";
      gameMode = PAUSE_MODE;
      wsLogger.saveJson(E); // save experiment
    }
  } else if (user.pause) {
    // unpause game
    eventMsg = "unpause";
    gameMode = PLAY_MODE;
    // jet.x = width / 2;
  } else if (user.next_block && gameMode != COMPLETE_MODE) {
    // go to the next block
    eventMsg = "new game (going to next block)";
    newGame(false);
  } else if (user.back_block && gameMode != COMPLETE_MODE) {
    // go back a block
    eventMsg = "new game (going back a block)";
    newGame(false, true);
  } else if (user.restart_block) {
    eventMsg = "restart block";
    newGame(true);
  } else if (user.save) {
    wsLogger.saveJson(E);
  }
  if (eventMsg !== undefined) {
    wsLogger.log("interaction", { eventMsg });
  }
}

// for discrete events that we want to timestamp
function markEvent() {
  photodiode.trigger(50);
  clickSound.play();
}

// hook up to universal controls
function keyPressed(event) {
  controls.keyPressed(event);
}
function keyReleased(event) {
  controls.keyReleased(event);
}
function mousePressed(event) {
  controls.mousePressed(event);
}
function mouseReleased(event) {
  controls.mouseReleased(event);
}

function getRenderInfo() {
  return {
    width: width,
    height: height,
    photodiode: photodiode,
    jetSpeed: jetSpeed,
    baseDriftSpeed: baseDriftSpeed,
    practiceDriftSpeed: practiceDriftSpeed,
    cueWidth: cueWidth,
    boatColors: BOAT_COLORS,
    explosionDuration: explosionDuration,
  };
}
