/////////////////////////////////////////////////
// Utility class to handle client-side throttling
window.APIThrottler = class APIThrottler {
    constructor(maxRequestsPerMinute = 20) {
      this.maxRequestsPerMinute = maxRequestsPerMinute;
      this.requestTimestamps = [];
      this.initialMaxRequests = maxRequestsPerMinute; // Store initial value for reference
      this.lastAdjustmentTime = null;
      this.adjustmentResetInterval = 5 * 60 * 1000; // 5 minutes in ms
    }
  
    canMakeRequest() {
      const now = Date.now();
  
      // Clean up old timestamps
      this.requestTimestamps = this.requestTimestamps.filter(
        (timestamp) => now - timestamp < 60000
      );
  
      // Check if we should reset rate limit after adjustment period
      if (
        this.lastAdjustmentTime &&
        now - this.lastAdjustmentTime > this.adjustmentResetInterval
      ) {
        console.log("Resetting rate limit to initial value");
        this.maxRequestsPerMinute = this.initialMaxRequests;
        this.lastAdjustmentTime = null;
      }
  
      return this.requestTimestamps.length < this.maxRequestsPerMinute;
    }
  
    logRequest() {
      this.requestTimestamps.push(Date.now());
    }
  
    getTimeUntilNextAvailable() {
      if (this.canMakeRequest()) return 0;
  
      const now = Date.now();
      // Sort timestamps to find the oldest one
      const sortedTimestamps = [...this.requestTimestamps].sort();
      const oldestTimestamp = sortedTimestamps[0];
  
      // The oldest timestamp will "expire" after 60 seconds
      return Math.max(0, 60000 - (now - oldestTimestamp));
    }
  
    adjustRateLimit(waitTimeMs) {
      // If we get a 429, reduce our rate limit
      const newLimit = Math.max(1, Math.floor(this.maxRequestsPerMinute * 0.8));
      console.log(
        `Adjusting rate limit from ${this.maxRequestsPerMinute} to ${newLimit} requests per minute`
      );
      this.maxRequestsPerMinute = newLimit;
      this.lastAdjustmentTime = Date.now();
    }
  };