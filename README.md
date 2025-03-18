# Phaser_NPC_AI

## Uses local ollama as chat completion

```js
          model: "qwen2.5-coder:7b",
          stream: false,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          format: "json",
        }
```
