class world extends Phaser.Scene {
  constructor() {
    super("world");
  }

  // incoming data from scene below
  init(data) {
    this.playerPos = data.playerPos;
  }

  preload() {
    // Step 1, load JSON
    this.load.tilemapTiledJSON("worldmap", "assets/RafflesklMap.tmj");

    // this.load.image("road", "assets/road.png");
    this.load.image("kenny", "assets/kenny.png");
    this.load.image("pippoya", "assets/pippoya.png");
    this.load.image("raffles", "assets/rafflesTiless-01.png");
    this.load.image("tree", "assets/tree.png");

  }

  create() {
    console.log("*** world scene");

    //Step 3 - Create the map from main
    let map = this.make.tilemap({ key: "worldmap" });
    this.map = map;

    // Step 4 Load the game tiles
    // 1st parameter is name in Tiled,
    // 2nd parameter is key in Preload
    let kennyTiles = map.addTilesetImage("kenny03", "kenny");
    let rafflesTiles = map.addTilesetImage("raffles01", "raffles");
    let pippoyaTiles = map.addTilesetImage("pippoya05", "pippoya");
    let treeTiles = map.addTilesetImage("tree04", "tree");

    let tilesArray = [kennyTiles, rafflesTiles, pippoyaTiles, treeTiles];

    // Step 5  Load in layers by layers
    this.groundLayer = map.createLayer("groundLayer", tilesArray, 0, 0);
    this.decorLayer = map.createLayer("decorLayer", tilesArray, 0, 0);
    this.buildingLayer = map.createLayer("buildingLayer", tilesArray, 0, 0);

    this.physics.world.bounds.width = this.groundLayer.width;
    this.physics.world.bounds.height = this.groundLayer.height;

    this.player = this.physics.add
      .sprite(this.playerPos.x, this.playerPos.y, "gen")
      .play("gen-down");
    window.player = this.player;

    this.player.setCollideWorldBounds(true); // don't go out of the this.map

    // this.swordSwing = this.physics.add
    //   .sprite(200, 300, "sword")
    //   .play("sword-down");
    // this.swordSwing.setVisible(false);

    // // create the arrow keys
    this.cursors = this.input.keyboard.createCursorKeys();

    // Phaser NPC-AI Project
    const apiKey = "";

    this.apiThrottler = new APIThrottler(10);


    this.npc1 = this.physics.add.sprite(200, 400, "enemy")
    .play("enemy-down").setImmovable().setName("npc1")
    this.npc2 = this.physics.add.sprite(1320, 250, "enemy2")
    .play("enemy2-down").setImmovable().setName("npc2")
    this.npc3 = this.physics.add.sprite(700, 250, "enemy3")
    .play("enemy3-down").setImmovable().setName("npc3")



    // this.coin1 = this.physics.add.sprite(500, 200, "coin").play("coinSpin");
    // this.coin2 = this.physics.add.sprite(500, 300, "coin").play("coinSpin");

     // Initialize coins group if missing
     this.coinGroup = this.physics.add.group({
      key: 'coin',
      repeat: 5,
      setXY: { x: 250, y: 175, stepX: 200 }
    });
    
    this.npc1.setCollideWorldBounds(true); // don't go out of the this.map
    this.npc2.setCollideWorldBounds(true); // don't go out of the this.map

    // Initialize AI controller for the NPC, 1 jedi, 0 sith
    this.npcController = new NPCAIController(
      this.npc1,
      this,
      this.player,
      "enemy",
      1,
      this.coinGroup
    );
    this.npcController2 = new NPCAIController(
      this.npc2,
      this,
      this.player,
      "enemy2",
      0,
      this.coinGroup
    );
    this.npcController3 = new NPCAIController(
      this.npc3,
      this,
      this.player,
      "enemy3",
      0,
      this.coinGroup
    );

    // Start the AI decision cycle (queries every 5 seconds)
    this.npcController.startAI(7000);
    this.npcController2.startAI(9000);
    this.npcController3.startAI(8000);

    // player cannot bump into decorations
    this.decorLayer.setCollisionByExclusion(-1, true);
    //this.physics.add.collider(this.player, this.decorLayer);

    // player cannot bump into buildings
    //this.buildingLayer.setCollisionByExclusion(-1, true);
    this.buildingLayer.setCollisionByProperty({ collides: true });

    // Add collision debug
    this.physics.world.createDebugGraphic();
    this.buildingLayer.renderDebug(this.physics.world.debugGraphic, {
      tileColor: new Phaser.Display.Color(255, 0, 0, 100)
    });

    this.physics.add.collider(this.player, this.buildingLayer);
    this.physics.add.collider([this.npc1, this.npc2, this.npc3], this.buildingLayer);

    this.physics.add.collider(this.player, [this.npc1, this.npc2, this.npc3]);

    this.physics.add.collider(this.npc1, [this.npc2, this.npc3]);
    this.physics.add.collider(this.npc2, [this.npc1, this.npc3]);
    this.physics.add.collider(this.npc3, [this.npc1, this.npc2]);

    let blackBox = new Phaser.Geom.Rectangle(0, 540, 640, 100);
    var graphics = this.add.graphics({ fillStyle: { color: 0x000000 } });
    graphics.fillRectShape(blackBox).setScrollFactor(0)

    this.debugText = this.add
    .text(10, 546, "", { fontSize: "16px", fill: "#ffffff" })
    .setScrollFactor(0);

    // camera follow player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.minimap1 = this.cameras
      .add(520, 380, 120, 120)
      .setZoom(0.4)
      .setName("mini1");
    this.minimap1.setBackgroundColor(0x000000);
    this.minimap1.startFollow(this.player);

  //   this.minimap2 = this.cameras
  //   .add(520, 510, 120, 120)
  //   .setZoom(0.4)
  //   .setName("mini2");
  // this.minimap2.setBackgroundColor(0x000000);
  // this.minimap2.startFollow(this.npc2);

  //   // Make minimap cameras ignore this text
  // this.minimap1.ignore(this.debugText);
  // this.minimap2.ignore(this.debugText);




  } /////////////////// end of create //////////////////////////////

  update() {

    // Update NPC AI
    this.npcController.update();
    this.npcController2.update();
    this.npcController3.update();


    // Update debug text
    this.updateDebugText();

    if (
      this.player.x > 480 &&
      this.player.x < 514 &&
      this.player.y > 400 &&
      this.player.y < 566
    ) {
      console.log("Player entering room1");
      this.room1();
    }

    const speed = 250;

    if (this.cursors.left.isDown) {
      this.player.body.setVelocityX(-speed);
      this.player.anims.play("gen-left", true); // walk left
    } else if (this.cursors.right.isDown) {
      this.player.body.setVelocityX(speed);
      this.player.anims.play("gen-right", true);
    } else if (this.cursors.up.isDown) {
      this.player.body.setVelocityY(-speed);
      this.player.anims.play("gen-up", true);
      //console.log('up');
    } else if (this.cursors.down.isDown) {
      this.player.body.setVelocityY(speed);
      this.player.anims.play("gen-down", true);
      //console.log('down');
    } else {
      this.player.anims.stop();
      this.player.body.setVelocity(0, 0);
    }
  } /////////////////// end of update //////////////////////////////

  updateDebugText() {
    // Get distance between NPCs
    const playerDist1 = Phaser.Math.Distance.Between(
      this.npc1.x, this.npc1.y,
      this.player.x, this.player.y
    );

    const playerDist2 = Phaser.Math.Distance.Between(
      this.npc2.x, this.npc2.y,
      this.player.x, this.player.y
    );

    const playerDist3 = Phaser.Math.Distance.Between(
      this.npc3.x, this.npc3.y,
      this.player.x, this.player.y
    );

    this.debugText.setText(
        `NPC1 (Jedi): ${
          this.npcController.currentTask
            ? this.npcController.currentTask.action
            : "None"
        } ` +
        `Pos: (${Math.round(this.npc1.x)}, ${Math.round(this.npc1.y)}) | ` +
        `Talks: ${this.npcController.memory.filter(a => a.action === 'talk').length} | ` +
        `Player: ${playerDist1 < 100 ? 'Nearby' : 'Far'}\n` +

        `NPC2 (Sith): ${
          this.npcController2.currentTask
            ? this.npcController2.currentTask.action
            : "None"
        } ` +
        `Pos: (${Math.round(this.npc2.x)}, ${Math.round(this.npc2.y)}) | ` +
        `Talks: ${this.npcController2.memory.filter(a => a.action === 'talk').length} | ` +
        `Player: ${playerDist2 < 100 ? 'Nearby' : 'Far'}\n`+

        `NPC3 (Sith): ${
          this.npcController3.currentTask
            ? this.npcController3.currentTask.action
            : "None"
        } ` +
        `Pos: (${Math.round(this.npc3.x)}, ${Math.round(this.npc3.y)}) | ` +
        `Talks: ${this.npcController3.memory.filter(a => a.action === 'talk').length} | ` +
        `Player: ${playerDist3 < 100 ? 'Nearby' : 'Far'}`
    );
  }


  // Function to jump to room1
  room1(player, tile) {
    console.log("room1 function");
    this.scene.start("room1");
  }
} //////////// end of class world ////////////////////////
