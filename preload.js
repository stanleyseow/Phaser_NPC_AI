class preload extends Phaser.Scene {
  constructor() {
    super("preload");

    // Put global variable here
  }

  preload() {

    this.load.spritesheet("gen", "assets/blank-64x64.png", {
      frameWidth: 64,
      frameHeight: 64,
    });

    this.load.spritesheet("enemy", "assets/enemy-64x64.png", {
      frameWidth: 64,
      frameHeight: 64,
    });

    this.load.spritesheet("enemy2", "assets/enemy2-64x64.png", {
      frameWidth: 64,
      frameHeight: 64,
    });


    this.load.spritesheet("sword", "assets/swordSwing-192x192.png", {
      frameWidth: 192,
      frameHeight: 192,
    });


    this.load.spritesheet("fire", "assets/fire.png", {
      frameWidth: 40,
      frameHeight: 70,
    });

    this.load.spritesheet('coin', 'assets/coin.png',{ frameWidth:32, frameHeight:32 });

  }

  create() {
    console.log("*** preload scene");

this.anims.create({
      key: "gen-up",
      frames: this.anims.generateFrameNumbers("gen", { start: 105, end: 112 }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "gen-left",
      frames: this.anims.generateFrameNumbers("gen", { start: 118, end: 125 }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "gen-down",
      frames: this.anims.generateFrameNumbers("gen", { start: 131, end: 138 }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "gen-right",
      frames: this.anims.generateFrameNumbers("gen", { start: 144, end: 151 }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "enemy-up",
      frames: this.anims.generateFrameNumbers("enemy", {
        start: 105,
        end: 112,
      }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "enemy-left",
      frames: this.anims.generateFrameNumbers("enemy", {
        start: 118,
        end: 125,
      }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "enemy-down",
      frames: this.anims.generateFrameNumbers("enemy", {
        start: 131,
        end: 138,
      }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "enemy-right",
      frames: this.anims.generateFrameNumbers("enemy", {
        start: 144,
        end: 151,
      }),
      frameRate: 5,
      repeat: -1,
    });



    this.anims.create({
      key: "enemy2-up",
      frames: this.anims.generateFrameNumbers("enemy2", {
        start: 105,
        end: 112,
      }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "enemy2-left",
      frames: this.anims.generateFrameNumbers("enemy2", {
        start: 118,
        end: 125,
      }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "enemy2-down",
      frames: this.anims.generateFrameNumbers("enemy2", {
        start: 131,
        end: 138,
      }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "enemy2-right",
      frames: this.anims.generateFrameNumbers("enemy2", {
        start: 144,
        end: 151,
      }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: "sword-up",
      frames: this.anims.generateFrameNumbers("sword", { start: 0, end: 5 }),
      frameRate: 20,
      repeat: 0,
    });

    this.anims.create({
      key: "sword-down",
      frames: this.anims.generateFrameNumbers("sword", { start: 12, end: 17 }),
      frameRate: 20,
      repeat: 0,
    });

    this.anims.create({
      key: "sword-left",
      frames: this.anims.generateFrameNumbers("sword", { start: 6, end: 11 }),
      frameRate: 20,
      repeat: 0,
    });

    this.anims.create({
      key: "sword-right",
      frames: this.anims.generateFrameNumbers("sword", { start: 18, end: 23 }),
      frameRate: 20,
      repeat: 0,
    });

    this.anims.create({
      key: "fireAnim",
      frames: this.anims.generateFrameNumbers("fire", { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key:'coinSpin',
      frames:this.anims.generateFrameNumbers('coin',
      { start:0, end:5 }),
      frameRate:5,
      repeat:-1
  });

    // Check for spacebar or any key here
    var spaceDown = this.input.keyboard.addKey("SPACE");

    // On spacebar event, call the world scene
    spaceDown.on(
      "down",
      function () {
        console.log("Jump to world scene");
        let playerPos = {}
        playerPos.x = 100
        playerPos.y = 550
        this.scene.start("world",  { playerPos: playerPos })
      },
      this
    );

    // Add any text in the main page
    this.add.text(90, 600, "Press spacebar to NPC-AI", {
      font: "30px Courier",
      fill: "#FFFFFF",
    });

    // Create all the game animations here
  }
}
