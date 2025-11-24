
class Grass {
  constructor(img, percent) {
    this.img = img;
    this.percent = percent;

    // compute side widths
    this.sideWidth = (width * (1 - this.percent)) / 2;
    this.scroll = 0;
    this.speed = driftSpeed; // same as river for consistent drift
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

class Jet {
  constructor(img, x, y) {
    this.img = img;
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 60;
    this.speed = jetSpeed;
    this.hitTime = 0;
  }
  
  takeHit() {
    if (!immobileMode) {
      this.hitTimer = 32; // number of frames for animation
    }
  }

  update() {
    if (immobileMode) {
      this.x = width / 2;
    } else {
      // let inputVel = getDirectionInput();
      // this.x += inputVel * this.speed;
      if (user.moveLeft) this.x -= this.speed;
      else if (user.moveRight) this.x += this.speed;
      // if (isPressingLeft()) this.x -= this.speed;
      // if (isPressingRight()) this.x += this.speed;
      this.x = constrain(this.x, this.width / 2, width - this.width / 2);
    }
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

class Boat {
  constructor(cue, x, y, nTilesPerCue = 1) {
    this.x = x;
    this.y = y;
    this.width = cueWidth;
    if (immobileMode) {
      this.x = width/2;
    }
    this.nTilesPerCue = nTilesPerCue;
    this.height = this.width / nTilesPerCue;

    this.speed = driftSpeed;
    this.cue = cue;
    this.color = BOAT_COLORS[this.cue];
    this.img = spriteSheet.getImage(trial_block.theme_offset + this.cue);
    this.hasBeenSeen = false;
  }

  update() {
    this.y += this.speed;
  }

  render() {
    push();

    rectMode(CENTER);
    if (this.img === undefined) fill(this.color);
    stroke('black');
    rect(this.x, this.y, this.width, this.height);
    noStroke();

    imageMode(CENTER);
    let tileW = this.height;          // each tile is square (height x height)
    let startX = this.x - this.width / 2 + tileW / 2; // leftmost tile center

    let actionToShow = this.getCorrectActionIndex()+1;
    if (showAnswers) {
      textFont(myFont);
      textSize(24);
      textAlign(CENTER, CENTER);
      fill('black');
    }
    for (let i = 0; i < this.nTilesPerCue; i++) {
      let tileX = startX + i * tileW;

      // check location
      let isHit = this.checkHitRect({x: jet.x, y: this.y}, tileX, this.y, tileW, this.height);
      // let doTint = 0;
      if (isHit) noTint();
      else tint(255, 128);
      // if (doTint)
      

      if (showAnswers) {
        text(actionToShow, tileX, this.y);
      } else {
        image(this.img, tileX, this.y, tileW, this.height);
        stroke('black');
        strokeWeight(2);
        noFill();
        rect(tileX, this.y, tileW, this.height);
      }
    }
    noStroke();
    pop();
    noTint();
  }

  getCorrectActionIndex() {
    let action_index = -1;
    let row = trial_block.R[this.cue];
    for (let i = 0; i < row.length; i++) {
      if (row[i] > 0) {
        action_index = i;
      }
    }
    return action_index;
  }

  onscreen() {
    let isOnscreen = this.y + this.height / 2 > 0;
    if (isOnscreen) this.hasBeenSeen = true;
    return isOnscreen;
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

  checkHitRect(projectile, x, y, width, height) {
    return (
      abs(x - projectile.x) < width / 2 &&
      abs(y - projectile.y) < height / 2
    );
  }

  checkHit(projectile, mustHitLocation) {
    if (mustHitLocation) return this.checkHitInCorrectLocation(projectile);
    return this.checkHitRect(projectile, this.x, this.y, this.width, this.height);
  }

  checkHitInCorrectLocation(projectile) {
    // check if projectile hit the correct location
    let tileW = this.height;          // each tile is square (height x height)
    let startX = this.x - this.width / 2 + tileW / 2; // leftmost tile center

    let action_index = this.getCorrectActionIndex();
    let tileX = startX + action_index * tileW;
    return this.checkHitRect(projectile, tileX, this.y, tileW, this.height);
  }
}

class Projectile {
  constructor(x, y, action) {
    this.x = x;
    this.y = y;
    this.speed = 8;
    this.action = action; // 1..D
    this.sizes = [8, 8, 8, 8, 8];
    this.colors = [color(0,0,0), color(0,0,0), color(0,0,0), color(0,0,0), color(0,0,0)];
  }

  update() {
    this.y -= this.speed;
  }

  render() {
    push();
    translate(this.x, this.y);
    fill(this.colors[this.action-1]);
    noStroke();
    ellipse(0, 0, this.sizes[this.action-1]);
    pop();
  }

  offscreen() {
    return this.y + this.sizes[this.action-1] < 0;
  }
}

function circlePositions(x_start, x_end, W) {
  // diameter
  let diam = 2 * W;
  
  // number of circles that fit
  let N = floor((x_end - x_start) / diam);
  
  let positions = [];
  for (let i = 0; i < N; i++) {
    // center of each circle
    let x = x_start + W + i * diam;
    positions.push(x);
  }
  return positions;
}

class Explosion {
  constructor(x_start, x_end, y, color) {
    this.x_start = x_start;
    this.x_end = x_end;
    this.y = y;
    this.color = color;
    this.maxLife = 20;
    this.life = 20;
    this.speed = driftSpeed;

    if (this.x_start === this.x_end) {
      this.xs = [this.x_start];
    } else {
      this.xs = circlePositions(this.x_start, this.x_end, 15);
    }
  }

  update() {
    this.life--;
    this.y += this.speed;
  }

  render() {
    push();
    noStroke();
    ellipseMode(CENTER);
    fill(this.color[0], this.color[1], this.color[2], map(this.life, this.maxLife, 0, 255, 0));
    for (let i = 0; i < this.xs.length; i++) {
      ellipse(this.xs[i], this.y, (this.maxLife - this.life) * 7);
    }
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
    this.streakBonus = streakBonus;

    this.isAnimating = false;
    this.scoreTarget;
    this.lastRefresh;
  }
  
  reset() {
    this.streak = 0;
  }

  update() {
    if (this.isAnimating) {
      if (trial_block.score < this.scoreTarget) {
        if (millis()-this.lastRefresh > 35) {
          trial_block.score++;
          this.lastRefresh = millis();
        }
      } else {
        this.isAnimating = false;
      }
    }
  }
  
  hit() {
    this.streak++;
    if (this.streak >= this.maxStreak) {
      this.streak = 0;
      this.scoreTarget = trial_block.score + this.streakBonus;
      this.lastRefresh = millis();
      this.isAnimating = true;
    }
  }
  
  render() {
    rectMode(CORNER);
    push();
    translate(this.x, this.y);
    noStroke();
    fill('green');
    let barWidth = map(this.streak, 0, this.maxStreak, 0, this.width);
    if (this.isAnimating) {
      barWidth = this.width;
      fill('yellow');
    }
    rect(0, 0, barWidth, this.height);

    textAlign(CENTER);
    textFont(myFont);
    textSize(24);
    fill('white');
    text('Streak:', -0.8*this.width/2, 2);

    if (true) { //(this.isAnimating) {
      fill('black');
      textFont(myFont);
      textSize(24);
      textAlign(CENTER);
      text('BONUS!', this.width / 2, 2);
    }
    stroke('white');
    strokeWeight(2);
    noFill();
    rect(0, 0, this.width, this.height);
    pop();
  }
}

class SquareSpriteSheet {
  constructor(imgPath, spriteSize) {
    this.spriteSize = spriteSize;
    this.sheet = loadImage(imgPath);  // must be called in preload()
  }

  // Call this after the image loads (setup or later)
  getImage(index) {
    const size = this.spriteSize;

    // Ensure the sheet is fully loaded
    if (!this.sheet.width || !this.sheet.height) {
      console.error("Sprite sheet not loaded yet.");
      return null;
    }

    const cols = Math.floor(this.sheet.width / size);
    const rows = Math.floor(this.sheet.height / size);
    const total = cols * rows;

    if (index < 0 || index >= total) {
      console.error(`Index ${index} out of range (0–${total - 1})`);
      return null;
    }

    // Compute row/column from linear index
    const sx = (index % cols) * size;
    const sy = Math.floor(index / cols) * size;

    // Extract subimage
    return this.sheet.get(sx, sy, size, size);
  }
}
