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

    // Initialize physics
    this.scene.physics.world.enable(this.npc);
    this.npc.body.setCollideWorldBounds(true);
    
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
    // this.log("Update called", {
    //   isProcessing: this.isProcessing,
    //   queueLength: this.taskQueue.length,
    //   isMoving: this.isMoving,
    //   currentTarget: this.currentTarget
    // });

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
    const systemPrompt = `You are an NPC controller. Respond ONLY with this exact JSON format and nothing else:
{"action": "move|talk|collect|drop|follow|wander", "params": {}}
  
Valid parameters:
- move: {"x": number, "y": number}
- talk: {"message": string}
- other actions: {}
  
CRITICAL: DO NOT add any text, comments, or formatting before or after the JSON.`;

    // User prompt with context
    const userPrompt = `Game state: ${JSON.stringify(context || this.gatherContext())}
Choose next action. Return ONLY valid JSON.`;

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
    
    // Keep only last 5 actions in memory
    this.memory.push(action);
    if (this.memory.length > 5) {
      this.memory.shift(); // Remove the oldest action
    }
    
    this.log("Current memory (last 5 actions):", this.memory);
  }

  executeNextTask() {
    if (this.taskQueue.length === 0) {
      this.log("No tasks to execute");
      this.isProcessing = false;
      return;
    }
    
    const task = this.taskQueue.shift();
    this.log("Executing task:", task);

    this.currentTask = task;
    
    // Execute based on action type
    switch (task.action) {
      case "move":
        this.moveTo(task.params.x, task.params.y);
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
    this.log(`Collecting coin at (${nearestCoin.x}, ${nearestCoin.y})`);
    this.isCollecting = true;
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
    this.log(`Speaking: "${message}"`);
    const text = this.scene.add
      .text(this.npc.x, this.npc.y - 40, message, {
        fontSize: "16px",
        backgroundColor: "#000",
        padding: 5,
      })
      .setOrigin(0.5);

    this.scene.time.delayedCall(3000, () => text.destroy());
  }

  gatherContext() {
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
      lastActions: this.memory.slice(-5) // Include last 5 actions
    };
    
    this.log("Gathered context:", context);
    return context;
  }

  useFallbackBehavior() {
    this.log("Using fallback behavior");
    const fallbacks = [
      () => this.wander(),
      () => this.followPlayer(),
      () => this.speak("The Force is unclear..."),
    ];

    fallbacks[Math.floor(Math.random() * fallbacks.length)]();
    this.retryCount = 0;
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
};

