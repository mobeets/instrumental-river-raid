
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
    this.speed = JET_SPEED;
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
      if (isPressingLeft()) this.x -= this.speed;
      if (isPressingRight()) this.x += this.speed;
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
  constructor(img, x, y) {
    this.img = img;
    this.x = x;
    this.y = y;
    this.width = CUE_WIDTH;
    if (immobileMode) {
      this.x = width/2;
    }
    this.height = 50;
    if (this.width % this.height > 0) {
      // increase height so that we can tile evenly
      let ntiles = int(this.width / this.height) + 1;
      this.height = this.width / ntiles;
    }

    this.speed = DRIFT_SPEED;
    this.colorIndex = int(random(K));
    this.color = BOAT_COLORS[this.colorIndex];
  }

  update() {
    this.y += this.speed;
  }

  render() {
    push();

    rectMode(CENTER);
    noStroke();
    fill(this.color);
    rect(this.x, this.y, this.width, this.height);

    imageMode(CENTER);
    if (!showAnswers) {
      tint(this.color);
    }

    let N = this.width / this.height; // number of tiles horizontally
    let tileW = this.height;          // each tile is square (height x height)
    let startX = this.x - this.width / 2 + tileW / 2; // leftmost tile center

    let action_index = -1;
    if (showAnswers) {
      let row = R[this.colorIndex];
      for (let i = 0; i < row.length; i++) {
        if (row[i] > 0) {
          action_index = i+1;
        }
      }
      textFont(myFont);
      textSize(24);
      textAlign(CENTER, CENTER);
      fill('black');
    }
    for (let i = 0; i < N; i++) {
      let tileX = startX + i * tileW;
      if (showAnswers) {
        text(action_index, tileX, this.y);
      } else {
        // image(this.img, tileX, this.y, tileW, this.height);
      }
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

function circlePositions(x_start, x_end, W) {
  // diameter
  let D = 2 * W;
  
  // number of circles that fit
  let N = floor((x_end - x_start) / D);
  
  let positions = [];
  for (let i = 0; i < N; i++) {
    // center of each circle
    let x = x_start + W + i * D;
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
    this.speed = DRIFT_SPEED;

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
      if (score < this.scoreTarget) {
        if (millis()-this.lastRefresh > 35) {
          score++;
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
      this.scoreTarget = score + this.streakBonus;
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
