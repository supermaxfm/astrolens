import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Enhanced Kalman Filter with track history and appearance features
class KalmanTracker {
  constructor(initialX, initialY, brightness, size) {
    this.state = [initialX, initialY, 0, 0];
    
    this.P = [
      [1000, 0, 0, 0],
      [0, 1000, 0, 0],
      [0, 0, 1000, 0],
      [0, 0, 0, 1000]
    ];
    
    this.Q = [
      [0.05, 0, 0, 0],
      [0, 0.05, 0, 0],
      [0, 0, 0.3, 0],
      [0, 0, 0, 0.3]
    ];
    
    this.R = [
      [3, 0],
      [0, 3]
    ];
    
    this.lastUpdate = Date.now();
    this.missedFrames = 0;
    this.age = 0;
    this.hitStreak = 0;
    
    // Appearance features for better association
    this.avgBrightness = brightness;
    this.avgSize = size;
    this.velocityHistory = [];
    this.maxVelocityHistoryLength = 5;
    
    // Track quality
    this.qualityScore = 0;
  }
  
  predict(dt) {
    const [x, y, vx, vy] = this.state;
    this.state = [
      x + vx * dt,
      y + vy * dt,
      vx,
      vy
    ];
    
    const F = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    
    this.P = this.matrixAdd(
      this.matrixMultiply(this.matrixMultiply(F, this.P), this.transpose(F)),
      this.Q
    );
    
    this.age++;
  }
  
  update(measurement, brightness, size) {
    const [mx, my] = measurement;
    
    const H = [
      [1, 0, 0, 0],
      [0, 1, 0, 0]
    ];
    
    const predicted = [this.state[0], this.state[1]];
    const innovation = [mx - predicted[0], my - predicted[1]];
    
    const S = this.matrixAdd(
      this.matrixMultiply(this.matrixMultiply(H, this.P), this.transpose(H)),
      this.R
    );
    
    const K = this.matrixMultiply(
      this.matrixMultiply(this.P, this.transpose(H)),
      this.matrixInverse2x2(S)
    );
    
    const stateUpdate = this.matrixVectorMultiply(this.transpose(K), innovation);
    const oldVx = this.state[2];
    const oldVy = this.state[3];
    
    this.state = this.state.map((s, i) => s + stateUpdate[i]);
    
    this.P = this.matrixMultiply(
      this.matrixSubtract(this.matrixIdentity(), this.matrixMultiply(K, H)),
      this.P
    );
    
    // Update velocity history for consistency checking
    const newVx = this.state[2];
    const newVy = this.state[3];
    this.velocityHistory.push({ vx: newVx, vy: newVy });
    if (this.velocityHistory.length > this.maxVelocityHistoryLength) {
      this.velocityHistory.shift();
    }
    
    // Update appearance features with smoothing
    this.avgBrightness = this.avgBrightness * 0.7 + brightness * 0.3;
    this.avgSize = this.avgSize * 0.7 + size * 0.3;
    
    this.lastUpdate = Date.now();
    this.missedFrames = 0;
    this.hitStreak++;
    
    // Update quality score
    this.updateQualityScore();
  }
  
  updateQualityScore() {
    // Quality based on hit streak, age, and velocity consistency
    const hitStreakScore = Math.min(this.hitStreak / 10, 1);
    const ageScore = Math.min(this.age / 20, 1);
    
    let velocityConsistency = 1;
    if (this.velocityHistory.length >= 3) {
      const avgVx = this.velocityHistory.reduce((sum, v) => sum + v.vx, 0) / this.velocityHistory.length;
      const avgVy = this.velocityHistory.reduce((sum, v) => sum + v.vy, 0) / this.velocityHistory.length;
      
      const variance = this.velocityHistory.reduce((sum, v) => {
        return sum + Math.pow(v.vx - avgVx, 2) + Math.pow(v.vy - avgVy, 2);
      }, 0) / this.velocityHistory.length;
      
      velocityConsistency = 1 / (1 + variance);
    }
    
    this.qualityScore = (hitStreakScore * 0.4 + ageScore * 0.3 + velocityConsistency * 0.3);
  }
  
  getVelocityConsistency() {
    if (this.velocityHistory.length < 2) return 1;
    
    const avgVx = this.velocityHistory.reduce((sum, v) => sum + v.vx, 0) / this.velocityHistory.length;
    const avgVy = this.velocityHistory.reduce((sum, v) => sum + v.vy, 0) / this.velocityHistory.length;
    
    const avgSpeed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
    return avgSpeed;
  }
  
  // Calculate association cost with a detection
  calculateAssociationCost(detection, maxDistance) {
    const pos = this.getPosition();
    const distance = Math.sqrt(
      Math.pow(detection.x - pos.x, 2) + 
      Math.pow(detection.y - pos.y, 2)
    );
    
    if (distance > maxDistance) return Infinity;
    
    // Normalized distance cost (0-1)
    const distanceCost = distance / maxDistance;
    
    // Appearance cost (brightness and size similarity)
    const brightnessDiff = Math.abs(detection.brightness - this.avgBrightness) / 255;
    const sizeDiff = Math.abs(detection.size - this.avgSize) / Math.max(detection.size, this.avgSize, 1);
    const appearanceCost = (brightnessDiff + sizeDiff) / 2;
    
    // Velocity consistency cost
    let velocityCost = 0;
    if (this.velocityHistory.length >= 2) {
      const expectedX = pos.x + this.state[2] * 0.1; // 0.1s ahead
      const expectedY = pos.y + this.state[3] * 0.1;
      const predictionError = Math.sqrt(
        Math.pow(detection.x - expectedX, 2) + 
        Math.pow(detection.y - expectedY, 2)
      );
      velocityCost = Math.min(predictionError / maxDistance, 1);
    }
    
    // Weighted combination (distance most important, then velocity, then appearance)
    const totalCost = distanceCost * 0.5 + velocityCost * 0.3 + appearanceCost * 0.2;
    
    return totalCost;
  }
  
  matrixMultiply(A, B) {
    const rowsA = A.length;
    const colsA = A[0].length;
    const colsB = B[0].length;
    const result = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));
    
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }
  
  matrixVectorMultiply(A, v) {
    return A.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
  }
  
  matrixAdd(A, B) {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  }
  
  matrixSubtract(A, B) {
    return A.map((row, i) => row.map((val, j) => val - B[i][j]));
  }
  
  matrixIdentity() {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }
  
  transpose(A) {
    return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
  }
  
  matrixInverse2x2(A) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (Math.abs(det) < 0.0001) {
      return [[1, 0], [0, 1]];
    }
    return [
      [A[1][1] / det, -A[0][1] / det],
      [-A[1][0] / det, A[0][0] / det]
    ];
  }
  
  getPosition() {
    return { x: this.state[0], y: this.state[1] };
  }
  
  getVelocity() {
    return { vx: this.state[2], vy: this.state[3] };
  }
  
  getSpeed() {
    const { vx, vy } = this.getVelocity();
    return Math.sqrt(vx * vx + vy * vy);
  }
  
  isConfirmed() {
    // Track is confirmed if it has at least 3 consecutive hits
    return this.hitStreak >= 3;
  }
}

// Global tracking state
const trackers = new Map();
let nextTrackerId = 1;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { frameData, width, height, settings, reset } = body;
    
    if (reset) {
      trackers.clear();
      nextTrackerId = 1;
      return Response.json({ success: true, tracks: [] });
    }
    
    if (!frameData || !width || !height) {
      return Response.json({ error: 'Missing frame data' }, { status: 400 });
    }
    
    const imageData = Uint8Array.from(atob(frameData.split(',')[1]), c => c.charCodeAt(0));
    const motionPoints = detectMotionPoints(imageData, width, height, settings || {});
    
    const currentTime = Date.now();
    const maxMissedFrames = 15; // Increased for better persistence
    
    // Predict all trackers forward
    trackers.forEach((tracker) => {
      const dt = (currentTime - tracker.lastUpdate) / 1000;
      tracker.predict(Math.min(dt, 0.5));
      tracker.missedFrames++;
    });
    
    // Hungarian algorithm (simplified greedy version) for optimal assignment
    const costMatrix = [];
    const trackerIds = Array.from(trackers.keys());
    
    // Build cost matrix
    trackerIds.forEach((trackerId) => {
      const tracker = trackers.get(trackerId);
      const costs = motionPoints.map((detection) => {
        // Use adaptive distance threshold based on track quality
        const baseDistance = 75;
        const adaptiveDistance = tracker.isConfirmed() ? baseDistance * 1.2 : baseDistance * 0.8;
        return tracker.calculateAssociationCost(detection, adaptiveDistance);
      });
      costMatrix.push({ trackerId, costs });
    });
    
    // Greedy assignment (optimal would use Hungarian algorithm, but this is simpler)
    const matchedDetections = new Set();
    const matchedTrackers = new Set();
    const assignments = [];
    
    // Sort trackers by quality (better tracks get priority in assignment)
    const sortedTrackerIds = trackerIds.sort((a, b) => {
      const trackerA = trackers.get(a);
      const trackerB = trackers.get(b);
      return trackerB.qualityScore - trackerA.qualityScore;
    });
    
    sortedTrackerIds.forEach((trackerId) => {
      if (matchedTrackers.has(trackerId)) return;
      
      const tracker = trackers.get(trackerId);
      const trackerIndex = trackerIds.indexOf(trackerId);
      const costs = costMatrix[trackerIndex].costs;
      
      let bestDetectionIdx = -1;
      let bestCost = Infinity;
      
      costs.forEach((cost, detectionIdx) => {
        if (!matchedDetections.has(detectionIdx) && cost < bestCost) {
          bestCost = cost;
          bestDetectionIdx = detectionIdx;
        }
      });
      
      // Only assign if cost is reasonable (threshold based on track state)
      const costThreshold = tracker.isConfirmed() ? 0.6 : 0.4;
      if (bestDetectionIdx !== -1 && bestCost < costThreshold) {
        const detection = motionPoints[bestDetectionIdx];
        tracker.update([detection.x, detection.y], detection.brightness, detection.size);
        matchedDetections.add(bestDetectionIdx);
        matchedTrackers.add(trackerId);
        assignments.push({ trackerId, detectionIdx: bestDetectionIdx });
      }
    });
    
    // Create new trackers for unmatched detections
    motionPoints.forEach((detection, idx) => {
      if (!matchedDetections.has(idx)) {
        const newTracker = new KalmanTracker(
          detection.x, 
          detection.y, 
          detection.brightness,
          detection.size
        );
        trackers.set(nextTrackerId++, newTracker);
      }
    });
    
    // Remove lost trackers (but be more patient with confirmed tracks)
    trackers.forEach((tracker, id) => {
      const maxMissed = tracker.isConfirmed() ? maxMissedFrames * 1.5 : maxMissedFrames;
      if (tracker.missedFrames > maxMissed) {
        trackers.delete(id);
      }
    });
    
    // Build response with confirmed tracks only (reduces noise)
    const tracks = [];
    trackers.forEach((tracker, id) => {
      // Only return confirmed tracks or very recent tentative ones
      if (tracker.isConfirmed() || tracker.age < 5) {
        const pos = tracker.getPosition();
        const vel = tracker.getVelocity();
        const speed = tracker.getSpeed();
        
        const confidence = Math.min(
          tracker.qualityScore * (1 - (tracker.missedFrames / (maxMissedFrames * 1.5))),
          1
        );
        
        const futureX = pos.x + vel.vx * 200;
        const futureY = pos.y + vel.vy * 200;
        
        tracks.push({
          id,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          vx: vel.vx,
          vy: vel.vy,
          speed: speed,
          confidence: confidence,
          missedFrames: tracker.missedFrames,
          hitStreak: tracker.hitStreak,
          age: tracker.age,
          isConfirmed: tracker.isConfirmed(),
          predictedPath: {
            start: { x: Math.round(pos.x), y: Math.round(pos.y) },
            end: { x: Math.round(futureX), y: Math.round(futureY) }
          }
        });
      }
    });
    
    return Response.json({ 
      success: true, 
      tracks,
      totalDetections: motionPoints.length,
      activeTrackers: trackers.size,
      confirmedTracks: tracks.filter(t => t.isConfirmed).length
    });
    
  } catch (error) {
    console.error('Tracking error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

function detectMotionPoints(imageData, width, height, settings) {
  const {
    motionThreshold = 15,
    brightnessThreshold = 30,
    minContourSize = 3,
    maxContourSize = 50
  } = settings;
  
  const motionPoints = [];
  const step = 4;
  
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];
      const brightness = (r + g + b) / 3;
      
      let contrastSum = 0;
      let validNeighbors = 0;
      
      for (let dy = -step; dy <= step; dy += step) {
        for (let dx = -step; dx <= step; dx += step) {
          if (dx === 0 && dy === 0) continue;
          
          const ny = y + dy;
          const nx = x + dx;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = (ny * width + nx) * 4;
            const nr = imageData[nidx];
            const ng = imageData[nidx + 1];
            const nb = imageData[nidx + 2];
            const nbrightness = (nr + ng + nb) / 3;
            
            contrastSum += Math.abs(brightness - nbrightness);
            validNeighbors++;
          }
        }
      }
      
      const avgContrast = validNeighbors > 0 ? contrastSum / validNeighbors : 0;
      
      if (brightness > brightnessThreshold && avgContrast > motionThreshold) {
        motionPoints.push({ 
          x, 
          y, 
          brightness,
          contrast: avgContrast
        });
      }
    }
  }
  
  const contours = groupIntoContours(motionPoints, 15);
  
  const filteredPoints = [];
  contours.forEach(contour => {
    if (contour.length >= minContourSize && contour.length <= maxContourSize) {
      const sumX = contour.reduce((sum, p) => sum + p.x, 0);
      const sumY = contour.reduce((sum, p) => sum + p.y, 0);
      const avgBrightness = contour.reduce((sum, p) => sum + p.brightness, 0) / contour.length;
      
      filteredPoints.push({
        x: sumX / contour.length,
        y: sumY / contour.length,
        brightness: avgBrightness,
        size: contour.length
      });
    }
  });
  
  return filteredPoints;
}

function groupIntoContours(points, maxDistance) {
  const contours = [];
  const visited = new Set();
  
  points.forEach((point, idx) => {
    if (visited.has(idx)) return;
    
    const contour = [point];
    visited.add(idx);
    
    const queue = [idx];
    while (queue.length > 0) {
      const currentIdx = queue.shift();
      const currentPoint = points[currentIdx];
      
      points.forEach((otherPoint, otherIdx) => {
        if (visited.has(otherIdx)) return;
        
        const distance = Math.sqrt(
          Math.pow(currentPoint.x - otherPoint.x, 2) +
          Math.pow(currentPoint.y - otherPoint.y, 2)
        );
        
        if (distance <= maxDistance) {
          contour.push(otherPoint);
          visited.add(otherIdx);
          queue.push(otherIdx);
        }
      });
    }
    
    contours.push(contour);
  });
  
  return contours;
}