window.NPCAIController = class NPCAIController {
  constructor(npc, scene, player, anims, jedi, coinGroup) {
    this.npc = npc;
    this.scene = scene;
    this.player = player;
    this.npcAnim = anims;
    this.jediType = jedi;
    this.coinGroup = coinGroup;

    // AI properties
    this.taskQueue = [];
    this.currentTask = ""
    this.isProcessing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.memory = []; // Last 5 actions history
    this.collectedItem = null;
    this.isCollecting = false;

    // Movement properties
    this.speed = 150;
    this.stopDistance = 32;
    this.currentTarget = null;
    this.isMoving = false;

    this.lastApiCallTime = 0;
    this.apiCallDelay = 5000; // 5 seconds in milliseconds

      // Add reflection text object
      // Comment out or remove reflection text initialization
      /*
      this.reflectionText = this.scene.add
        .text(this.npc.x, this.npc.y + 40, "...", {
          fontSize: "12px",
          backgroundColor: "#333",
          padding: 3,
          fontStyle: 'italic'
        })
        .setOrigin(0.5);
      */
      
      // Initialize physics
    this.scene.physics.world.enable(this.npc);
    this.npc.body.setCollideWorldBounds(true);

    // Enhanced memory system
  this.memoryStream = {
    observations: [],
    reflections: [],
    plans: []
  };
  
  // Memory configuration
  this.memoryConfig = {
    maxObservations: 20,
    maxReflections: 10,
    maxPlans: 5,
    recencyWeight: 0.5,
    importanceWeight: 0.3,
    relevanceWeight: 0.2
  };

  // Planning system
  this.currentPlan = {
    dayLevel: null,
    hourLevel: null,
    immediateActions: []
  };
  
    
    // Debug flag
    this.debug = true;
  }

  // Debug utility
  log(...args) {
    if (this.debug) {
      console.log("NPC: ", this.npc.name, ...args);
    }
  }

  update() {

      // Update reflection text position to follow NPC
      // if (this.reflectionText) {
      //   this.reflectionText.setPosition(this.npc.x, this.npc.y + 40);
        
      //   // Update reflection text content
      //   const currentReflection = this.memoryStream.reflections[this.memoryStream.reflections.length - 1];
      //   if (currentReflection) {
      //     this.reflectionText.setText(currentReflection.insight);
      //   }
      // }

    // Execute tasks if we're not busy and have tasks queued
    if (!this.isProcessing && this.taskQueue.length > 0) {
      this.log("Executing next task from queue");
      this.isProcessing = true;
      this.executeNextTask();
    }

    // Check movement progress if we're moving
    if (this.isMoving && this.currentTarget) {
      this.checkMovementProgress();
    }

    // Check item collection if we're collecting
    if (this.isCollecting) {
      this.checkItemCollection();
    }
  }

  robustJSONParse(responseText) {
    // Try direct parsing first
    try {
      return JSON.parse(responseText);
    } catch (e) {
      this.log("Standard JSON parse failed, attempting to extract valid JSON");
    }

    // Try to extract valid JSON
    try {
      const firstBrace = responseText.indexOf("{");
      if (firstBrace === -1) {
        throw new Error("No JSON object found in response");
      }

      let depth = 0;
      let lastBrace = -1;

      for (let i = firstBrace; i < responseText.length; i++) {
        if (responseText[i] === "{") depth++;
        if (responseText[i] === "}") {
          depth--;
          if (depth === 0) {
            lastBrace = i;
            break;
          }
        }
      }

      if (lastBrace === -1) {
        throw new Error("No complete JSON object found");
      }

      const jsonPart = responseText.substring(firstBrace, lastBrace + 1);
      this.log("Extracted JSON part:", jsonPart);

      return JSON.parse(jsonPart);
    } catch (extractError) {
      this.log("Error extracting JSON:", extractError);

      // Last resort: try to manually find action
      try {
        const actionMatch = responseText.match(/"action"\s*:\s*"([^"]+)"/);
        if (actionMatch) {
          const action = actionMatch[1];
          let params = {};
          const paramsMatch = responseText.match(/"params"\s*:\s*({[^}]*})/);
          if (paramsMatch) {
            try {
              params = JSON.parse(
                paramsMatch[1].replace(
                  /(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
                  '"$2":'
                )
              );
            } catch (e) {
              this.log("Could not parse params, using empty object");
            }
          }
          return { action, params };
        }
      } catch (e) {
        this.log("All parsing attempts failed");
      }

      throw new Error("Could not parse response as JSON");
    }
  }

  async getAIResponse(context) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCallTime;

    if (timeSinceLastCall < this.apiCallDelay) {
      const waitTime = this.apiCallDelay - timeSinceLastCall;
      this.log(`Waiting ${waitTime}ms before next API call`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastApiCallTime = Date.now();

    const isJedi = this.jediType === 1;
    const alignment = isJedi ? "Jedi Master" : "Sith Lord";

    // System prompt for AI
    const systemPrompt = `You are a ${alignment} NPC controller with memory and emotional awareness. 
    Your personality and actions should reflect your ${alignment} nature:
    ${isJedi ? 
      "- As a Jedi: Prioritize following and talking the player, seeking player to join the jedi" : 
      "- As a Sith: Prefer throw knive to player when nearby, be opportunistic, seek power through items and dominance"
    }
    
    Respond ONLY with this exact JSON format:
    // In the systemPrompt string, update the action list:
    {"action": "move|talk|collect|drop|follow|wander|throwKnife", 
    "params": {},
    "reflection": "string describing thought process"}
    
    Valid parameters:
    - move: {"x": number, "y": number}
    - talk: {"message": string}
    - throwKnife: {"target": "player"}
    - other actions: {}
    
    CRITICAL: DO NOT add any text, comments, or formatting before or after the JSON.`;

    // User prompt with context
    const userPrompt = `Game state: ${JSON.stringify(context || this.gatherContext())}
Choose next action. Return ONLY valid JSON.`;

    this.log("Initiating AI decision process with current state:", {
      position: `(${this.npc.x}, ${this.npc.y})`,
      emotionalState: this.calculateEmotionalState(),
      recentObservations: this.memoryStream.observations.slice(-2),
      context: context || this.gatherContext()
    });

    this.log("Sending API request with context:", context || this.gatherContext());

    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-coder:7b",
          stream: false,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          format: "json",
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const text = await response.text();
      this.log("Raw API response text:", text);

      // Parse response
      const parsed = this.robustJSONParse(text);
      return {
        message: {
          content: JSON.stringify(parsed),
        },
      };
    } catch (error) {
      this.log("AI API Error:", error);
      throw error;
    }
  }

  parseAIResponse(jsonResponse) {
    this.log("Parsing API response:", JSON.stringify(jsonResponse));
    
    try {
      // Helper function to recursively find action data
      const findAction = (obj) => {
        // Base case: direct action object
        if (obj && obj.action && typeof obj.action === 'string') {
          return {
            action: obj.action,
            params: obj.params || {}
          };
        }
        
        // Case: message content is a string
        if (obj && obj.message && typeof obj.message.content === 'string') {
          try {
            const parsed = JSON.parse(obj.message.content);
            return findAction(parsed);
          } catch (e) {
            this.log("Error parsing message content:", e);
          }
        }
        
        // Case: checking nested message content
        if (obj && obj.message && obj.message.content) {
          return findAction(obj.message.content);
        }
        
        // Recursively check all object properties
        if (obj && typeof obj === 'object') {
          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              const result = findAction(obj[key]);
              if (result) return result;
            }
          }
        }
        
        return null;
      };
      
      // Try to find the action in the response
      const actionData = findAction(jsonResponse);
      
      if (actionData) {
        this.log("Found action:", actionData);
        return actionData;
      }
      
      this.log("No action found in response");
      return { action: "wander", params: {} }; // Default action
    } catch (error) {
      this.log(`Error parsing AI response: ${error.message}`, error);
      return { action: "wander", params: {} };
    }
  }

  async queryAI(context) {
    this.log("Starting AI query");
    try {
      const response = await this.getAIResponse(context);
      this.log("Received response from API");
      
      // Extract the action from the response
      const actionData = this.parseAIResponse(response);
      this.log("Extracted action:", actionData);
      
      // Add the action to the queue if valid
      if (actionData && actionData.action) {
        this.log("Queueing valid action:", actionData.action);
        this.queueValidAction(actionData);
      } else {
        this.log("No valid action found, using fallback");
        this.queueValidAction({ action: "wander", params: {} });
      }
      
      return actionData;
    } catch (error) {
      this.log("AI query failed:", error);
      const fallback = { action: "wander", params: {} };
      this.queueValidAction(fallback);
      return fallback;
    }
  }

  queueValidAction(action) {
    this.log("Adding action to queue:", action);
    this.taskQueue.push(action);
    
    // Keep only last 10 actions in memory (increased from 5)
    this.memory.push(action);
    if (this.memory.length > 10) {
      this.memory.shift(); // Remove the oldest action
    }
    
    this.log("Current memory (last 10 actions):", this.memory);
  }

  // Update gatherContext to include more historical actions
  gatherContext() {
    const reflection = this.generateReflection();
    
    // Find nearest coin
    const coins = this.coinGroup.getChildren().filter((coin) => coin.active);
    const nearestCoin = coins.length > 0 ? 
      this.scene.physics.closest(this.npc, coins) : null;
    
    const context = {
      npc: { x: Math.round(this.npc.x), y: Math.round(this.npc.y) },
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
      hasItem: !!this.collectedItem,
      nearPlayer:
        Phaser.Math.Distance.Between(
          this.npc.x,
          this.npc.y,
          this.player.x,
          this.player.y
        ) < 200,
      itemsAvailable: this.coinGroup.countActive() > 0,
      nearestCoin: nearestCoin ? { 
        x: Math.round(nearestCoin.x), 
        y: Math.round(nearestCoin.y),
        distance: Math.round(Phaser.Math.Distance.Between(
          this.npc.x, this.npc.y, 
          nearestCoin.x, nearestCoin.y
        ))
      } : null,
      lastActions: this.memory.slice(-5) // Include last 5 actions
    };
    
    this.log("Gathered context:", context);
    return context;
  }

  executeNextTask() {
      // Log memory stream and player interaction status
      const playerInteractions = {
        talks: this.memory.filter(a => a.action === 'talk').length,
        follows: this.memory.filter(a => a.action === 'follow').length
      };
  
      this.log("Memory Stream Status:", {
        observations: this.memoryStream.observations.length,
        reflections: {
          total: this.memoryStream.reflections.length,
          playerInteractions: playerInteractions,
        },
        plans: this.memoryStream.plans.length,
        recentObservations: this.memoryStream.observations.slice(-2),
        recentReflections: this.memoryStream.reflections.slice(-1)
      });
  
      const now = Date.now();
      if (now - this.lastTaskTime < this.taskInterval) {
        // If not enough time has passed, re-queue the task
        const task = this.taskQueue[0];
        setTimeout(() => this.executeNextTask(), this.taskInterval - (now - this.lastTaskTime));
        return;
      }
  
      if (this.taskQueue.length === 0) {
        this.log("No tasks to execute");
        this.isProcessing = false;
        return;
      }
      
      const task = this.taskQueue.shift();
      this.log("Executing task:", task);
      this.lastTaskTime = now;
      this.currentTask = task;
      
      // Execute based on action type
      switch (task.action) {
        case "move":
          this.moveTo(task.params.x, task.params.y);
          break;
        case "throwKnife":
          this.throwKnife();
          setTimeout(() => { this.isProcessing = false; }, 100);
          break;
        case "talk":
          this.speak(task.params.message);
          // Immediate actions set isProcessing to false right away
          setTimeout(() => { this.isProcessing = false; }, 100);
          break;
        case "collect":
          this.collectNearestItem();
          break;
        case "drop":
          this.dropItem();
          // Immediate actions set isProcessing to false right away
          setTimeout(() => { this.isProcessing = false; }, 100);
          break;
        case "follow":
          this.followPlayer();
          break;
        case "wander":
          this.wander();
          break;
        default:
          this.log("Unknown action type:", task.action);
          this.isProcessing = false;
      }
  }


  throwKnife() {
    // Create and throw a knife at the player from enemy2
      this.knife = this.physics.add.sprite(enemy.x, enemy.y, "knifeImg").play("knifeAnim");
      knife.damage = 10;
      knife.setScale(1); // Scale the knife as needed
    
      // Calculate direction from enemy to player
      const angle = Phaser.Math.Angle.Between(this.npc.x, this.npc.y, this.player.x, this.player.y);
      
      // Set velocity based on angle
      const speed = 200; // Adjust speed as needed
      knife.body.velocity.x = Math.cos(angle) * speed;
      knife.body.velocity.y = Math.sin(angle) * speed;
      
      // Rotate knife to face direction of travel
      knife.rotation = angle + Math.PI/2; // Add offset if needed based on your knife sprite
      
      // Add collision with player
      //this.physics.add.overlap(this.player, knife, this.handleKnifeHit, null, this);
      //this.physics.add.overlap(this.enemies, knife, this.handleKnifeHitEnemy, null, this);
      //this.knives.add(knife);

  }

  moveTo(x, y) {
    this.log(`Moving to (${x}, ${y})`);
    this.isMoving = true;
    this.currentTarget = { x, y };

    const angle = Phaser.Math.Angle.Between(this.npc.x, this.npc.y, x, y);
    this.scene.physics.moveTo(this.npc, x, y, this.speed);
    this.playMovementAnimation(angle);
    
    // Safety timeout in case movement gets stuck
    this.moveTimeout = setTimeout(() => {
      if (this.isMoving) {
        this.log("Movement timeout - force stopping");
        this.stopMovement();
        this.isProcessing = false;
      }
    }, 10000); // 10 second timeout
  }

  playMovementAnimation(angle) {
    const directions = {
      right: angle < Math.PI / 4 || angle > (7 * Math.PI) / 4,
      left: angle > (3 * Math.PI) / 4 && angle < (5 * Math.PI) / 4,
      up: angle > Math.PI / 4 && angle < (3 * Math.PI) / 4,
      down: angle > (5 * Math.PI) / 4 && angle < (7 * Math.PI) / 4,
    };

    const direction = Object.keys(directions).find((k) => directions[k]) || "down";
    this.log(`Playing animation: ${this.npcAnim}-${direction}`);
    this.npc.anims.play(`${this.npcAnim}-${direction}`, true);
  }

  checkMovementProgress() {
    if (!this.currentTarget) {
      this.log("No current target to check progress against");
      this.isMoving = false;
      this.isProcessing = false;
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.npc.x,
      this.npc.y,
      this.currentTarget.x,
      this.currentTarget.y
    );

    //this.log(`Distance to target: ${distance}, stop distance: ${this.stopDistance}`);

    if (distance < this.stopDistance) {
      this.log("Reached destination, stopping movement");
      this.stopMovement();
      this.isProcessing = false;
    }
  }

  stopMovement() {
    this.log("Stopping movement");
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
    }
    
    if (this.npc.body) {
      this.npc.body.setVelocity(0, 0);
      this.npc.body.stop();
    }
    
    this.npc.anims.stop();
    this.isMoving = false;
    this.currentTarget = null;
  }

  collectNearestItem() {
    if (this.collectedItem || this.isCollecting) {
      this.log("Already collecting or has item");
      this.isProcessing = false;
      return;
    }

    const coins = this.coinGroup.getChildren().filter((coin) => coin.active);
    if (coins.length === 0) {
      this.log("No coins available to collect");
      this.isProcessing = false;
      return;
    }

    const nearestCoin = this.scene.physics.closest(this.npc, coins);
    if (!nearestCoin) {
      this.log("No nearest coin found");
      this.isProcessing = false;
      return;
    }

    this.log(`Collecting coin at (${nearestCoin.x}, ${nearestCoin.y})`);
    this.isCollecting = true;
    this.currentTarget = nearestCoin;  // Set the current target to the coin
    this.moveTo(nearestCoin.x, nearestCoin.y);
  }

  checkItemCollection() {
    if (!this.currentTarget) {
      this.log("No target for item collection");
      this.isCollecting = false;
      this.isProcessing = false;
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.npc.x,
      this.npc.y,
      this.currentTarget.x,
      this.currentTarget.y
    );

    if (distance < 10) {
      this.log("Item collected");
      this.collectedItem = this.currentTarget;
      this.currentTarget.disableBody(true, true);
      this.isCollecting = false;
      this.stopMovement();
      this.isProcessing = false;
    }
  }

  dropItem() {
    if (!this.collectedItem) {
      this.log("No item to drop");
      return;
    }

    this.log(`Dropping item at (${this.npc.x}, ${this.npc.y})`);
    this.collectedItem.enableBody(true, this.npc.x, this.npc.y, true, true);
    this.collectedItem = null;
  }

  followPlayer() {
    this.log(`Following player at (${this.player.x}, ${this.player.y})`);
    this.moveTo(this.player.x, this.player.y);
  }

  wander() {
    const x = Phaser.Math.Between(50, 750);
    const y = Phaser.Math.Between(50, 550);
    this.log(`Wandering to random location (${x}, ${y})`);
    this.moveTo(x, y);
  }

  speak(message) {
      if (!message) {
        this.log("No message to speak");
        this.isProcessing = false;
        return;
      }
  
      const distance = Phaser.Math.Distance.Between(
        this.npc.x,
        this.npc.y,
        this.player.x,
        this.player.y
      );
  
      if (distance > 150) {
        this.log("Too far from player to speak");
        this.isProcessing = false;
        return;
      }
  
      // Create speech text above player
      const text = this.scene.add
        .text(this.npc.x, this.npc.y - 40, message, {
          fontSize: "14px",
          backgroundColor: "#000",
          padding: { x: 5, y: 5 },
          color: '#ffffff'
        })
        .setOrigin(0.5)
        .setDepth(100);
  
      // Destroy text after delay
      this.scene.time.delayedCall(5000, () => {
        if (text) text.destroy();
      });
    }

  

  // New method to add observations
  addObservation(observation) {
    const timestamp = Date.now();
    this.memoryStream.observations.push({
      content: observation,
      timestamp,
      importance: this.calculateImportance(observation)
    });

    // Trim old observations
    if (this.memoryStream.observations.length > this.memoryConfig.maxObservations) {
      this.memoryStream.observations.shift();
    }
  }

  // New method to calculate memory importance
  calculateImportance(memory) {
    // Basic importance calculation
    let importance = 0;
    
    // Higher importance for player interactions
    if (memory.includes('player')) importance += 0.3;
    
    // Higher importance for item interactions
    if (memory.includes('collect') || memory.includes('drop')) importance += 0.2;
    
    return Math.min(1, importance);
  }

  // Enhanced context gathering
  // Add new method for reflection
  generateReflection() {
    const isJedi = this.jediType === 1;
    const recentActions = this.memory.slice(-3);
    const emotionalState = this.calculateEmotionalState();
    
    let reflection = {
      type: isJedi ? 'meditation' : 'contemplation',
      insight: '',
      influence: 0
    };

    // Analyze recent actions
    if (recentActions.length > 0) {
      const patterns = this.analyzeActionPatterns(recentActions);
      reflection.insight = this.generateInsightBasedOnAlignment(patterns);
      reflection.influence = this.calculateReflectionInfluence(patterns);
    }

    this.memoryStream.reflections.push(reflection);
    return reflection;
  }

  analyzeActionPatterns(actions) {
    return {
      playerInteractions: actions.filter(a => a.action === 'follow' || a.action === 'talk').length,
      itemInteractions: actions.filter(a => a.action === 'collect' || a.action === 'drop').length,
      exploration: actions.filter(a => a.action === 'wander' || a.action === 'move').length
    };
  }

  generateInsightBasedOnAlignment(patterns) {
    const isJedi = this.jediType === 1;
    
    // Calculate distances and angle
    const playerDistance = Phaser.Math.Distance.Between(
      this.npc.x, this.npc.y,
      this.player.x, this.player.y
    );
    
    const playerAngle = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(
        this.npc.x, this.npc.y,
        this.player.x, this.player.y
      )
    ).toFixed(0);
    
    const situation = `Player: ${Math.round(playerDistance)}px away at ${playerAngle}°`;

    if (isJedi) {
      let quote = "";
      if (patterns.playerInteractions > 1) {
        quote = "Through unity, we find strength in the Force.";
      } else if (patterns.itemInteractions > 1) {
        quote = "Possessions cloud the mind. Let them go.";
      } else if (patterns.exploration > 1) {
        quote = "Knowledge and wisdom come from exploration.";
      } else {
        quote = "Peace and serenity guide our path.";
      }
      return situation + "\n" + quote;
    } else {
      let quote = "";
      if (patterns.playerInteractions > 1) {
        quote = "Your potential for darkness grows stronger.";
      } else if (patterns.itemInteractions > 1) {
        quote = "Power comes to those who seize it.";
      } else if (patterns.exploration > 1) {
        quote = "The galaxy will bow before my might.";
      } else {
        quote = "Embrace your hatred, let it fuel you.";
      }
      return situation + "\n" + quote;
    }
  }

  // Update useFallbackBehavior with more distinct alignment behaviors
  useFallbackBehavior() {
    this.log("Using alignment-based fallback behavior");
    const isJedi = this.jediType === 1;
    
    const fallbacks = isJedi ? [
      () => this.followPlayer(),
      () => this.followPlayer(),  // Double weight for following
      () => this.speak("May the Force be with you"),
      () => this.wander()
    ] : [
      () => this.wander(),
      () => this.wander(),  // Double weight for wandering
      () => this.speak("You don't know the power of the dark side"),
      () => this.collectNearestItem()
    ];

    fallbacks[Math.floor(Math.random() * fallbacks.length)]();
    this.retryCount = 0;
  }

 
  // New method to calculate emotional state
  // Update calculateEmotionalState to consider alignment
  calculateEmotionalState() {
    const recentMemories = this.memoryStream.observations.slice(-5);
    const isJedi = this.jediType === 1;
    let state = 'neutral';
    
    // Simple emotion calculation based on recent events and alignment
    const playerInteractions = recentMemories.filter(m => 
      m.content.includes('player')).length;
    
    if (isJedi) {
      if (playerInteractions > 3) state = 'serene';
      if (this.collectedItem) state = 'mindful';
    } else {
      if (playerInteractions > 3) state = 'dominant';
      if (this.collectedItem) state = 'possessive';
    }
    
    return state;
  }

  startAI(interval = 5000) {
    this.log(`Starting AI with interval: ${interval}ms`);
    
    // Initial query
    this.queryAI(this.gatherContext());
    
    // Set up interval for recurring queries
    this.aiInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.log("Regular interval - requesting new action");
        this.queryAI(this.gatherContext());
      } else {
        this.log("Skipping AI query - still processing previous action");
      }
    }, interval);
  }

  stopAI() {
    this.log("Stopping AI");
    if (this.aiInterval) {
      clearInterval(this.aiInterval);
    }
  }

  calculateReflectionInfluence(patterns) {
    // Calculate influence based on action patterns
    const influence = {
      jedi: (patterns.playerInteractions * 0.4 + patterns.exploration * 0.2),
      sith: (patterns.itemInteractions * 0.4 + patterns.exploration * 0.3)
    };
    
    return Math.min(1, this.jediType === 1 ? influence.jedi : influence.sith);
  }
  


// Update throwKnife method:
  throwKnife() {
    this.log("Throwing knife at player");
    const knife = this.scene.physics.add.sprite(this.npc.x, this.npc.y, "knifeImg");
    knife.play("knifeAnim");
    knife.damage = 10;
    knife.setScale(1);
    
    const angle = Phaser.Math.Angle.Between(
      this.npc.x, this.npc.y, 
      this.player.x, this.player.y
    );
    
    const speed = 200;
    knife.body.velocity.x = Math.cos(angle) * speed;
    knife.body.velocity.y = Math.sin(angle) * speed;
    knife.rotation = angle + Math.PI/2;
    
    // Auto-destroy knife after 2 seconds
    this.scene.time.delayedCall(5000, () => {
      knife.destroy();
    });
  }

}

