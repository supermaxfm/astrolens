import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Camera, Play, Pause, Target, ToggleLeft, ToggleRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

import SourceSelector from "../components/satellite/SourceSelector";
import CameraSelector from "../components/satellite/CameraSelector";
import SatelliteView from "../components/satellite/SatelliteView";
import SettingsMenu from "../components/satellite/SettingsMenu";
import XmasOverlay from "../components/xmas/XmasOverlay";

// --- Default tracking settings ---
const DEFAULT_SETTINGS = {
  motionThreshold: 15,
  brightnessThreshold: 30,
  observationPoints: 8,
  deviationThreshold: 35,
  smoothingFactor: 0.5,
  useBackendTracking: true,
  xmasMode: false
};

// --- Other constants ---
const CONFIRMATION_DURATION = 2500;
const LOST_SATELLITE_TIMEOUT = 5000;
const LOST_SATELLITE_SEARCH_RADIUS = 70;

export default function StarGazer() {
  const [sourceType, setSourceType] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingMode, setTrackingMode] = useState('satellites');
  const [webcamReady, setWebcamReady] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [satellites, setSatellites] = useState([]);
  const [motionBoxes, setMotionBoxes] = useState([]);
  const [trackingStats, setTrackingStats] = useState({ detected: 0, active: 0 });
  const [videoUrl, setVideoUrl] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [trackingSettings, setTrackingSettings] = useState(() => {
    const saved = localStorage.getItem('astrolens_tracking_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const previousFrameRef = useRef(null);
  const detectedAreasRef = useRef(new Set());
  const lastAlertTimeRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('astrolens_tracking_settings', JSON.stringify(trackingSettings));
  }, [trackingSettings]);

  const getAvailableCameras = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      setSourceType('camera_select');
    } catch (error) {
      console.error("Error getting cameras:", error);
      alert("Could not access cameras. Please check permissions.");
    }
  };

  const startWebcam = async (deviceId = null) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
      
      const constraints = { 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
          facingMode: deviceId ? undefined : 'environment'
        } 
      };
      
      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setSourceType('webcam');
    } catch (error) {
      console.error("Error accessing webcam:", error);
      alert(`Could not access the selected camera: ${error.message}`);
      setSourceType(null);
    }
  };

  const handleVideoUpload = (file) => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setSourceType('video');
  };

  useEffect(() => {
    let videoElement = videoRef.current;
    if (!videoElement) return;

    const onLoadedMetadata = () => {
        setWebcamReady(true);
        if (canvasRef.current && overlayCanvasRef.current) {
            canvasRef.current.width = videoElement.videoWidth;
            canvasRef.current.height = videoElement.videoHeight;
            overlayCanvasRef.current.width = videoElement.videoWidth;
            overlayCanvasRef.current.height = videoElement.videoHeight;
        }
        if (sourceType === 'video') {
            videoElement.play().catch(console.error);
        }
    };
    
    if (sourceType === 'webcam' && streamRef.current) {
        videoElement.srcObject = streamRef.current;
        videoElement.play().catch(console.error);
    } else if (sourceType === 'video' && videoUrl) {
        videoElement.srcObject = null;
        videoElement.src = videoUrl;
    }

    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    if (videoElement.readyState >= 1) {
        onLoadedMetadata();
    }

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
      if (videoElement.src) {
        videoElement.src = '';
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
      }
    };
  }, [sourceType, videoUrl]);

  const playDeviationAlert = useCallback(() => {
    const currentTime = Date.now();
    const timeSinceLastAlert = currentTime - lastAlertTimeRef.current;
    
    if (timeSinceLastAlert >= 15000) {
      lastAlertTimeRef.current = currentTime;
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Target detected');
        
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('female') || 
          voice.name.toLowerCase().includes('woman') ||
          voice.name.toLowerCase().includes('samantha') ||
          voice.name.toLowerCase().includes('victoria') ||
          voice.name.toLowerCase().includes('zira')
        );
        
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }
        
        utterance.rate = 0.95;
        utterance.pitch = 1.3;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, []);

  const calculateTrajectory = useCallback((positions) => {
    if (positions.length < 3) return null;

    const n = positions.length;
    let sumX = 0, sumY = 0, sumT = 0;
    let sumXT = 0, sumYT = 0, sumTT = 0;

    positions.forEach((pos, index) => {
      const t = index;
      sumX += pos.x;
      sumY += pos.y;
      sumT += t;
      sumXT += pos.x * t;
      sumYT += pos.y * t;
      sumTT += t * t;
    });

    const denominator = (n * sumTT - sumT * sumT);
    
    if (denominator === 0) return null;

    const velocityX = (n * sumXT - sumT * sumX) / denominator;
    const velocityY = (n * sumYT - sumT * sumY) / denominator;

    const interceptX = (sumX - velocityX * sumT) / n;
    const interceptY = (sumY - velocityY * sumT) / n;

    const currentT = n - 1;
    const predictedCurrentX = interceptX + velocityX * currentT;
    const predictedCurrentY = interceptY + velocityY * currentT;

    const projectionDistance = 200;

    return {
      start: { x: predictedCurrentX, y: predictedCurrentY },
      end: {
        x: predictedCurrentX + velocityX * projectionDistance,
        y: predictedCurrentY + velocityY * projectionDistance
      },
      velocity: { x: velocityX, y: velocityY },
      intercept: { x: interceptX, y: interceptY }
    };
  }, []);

  const getPredictedPosition = useCallback((satellite, currentTime) => {
    if (!satellite.predictedPath || !satellite.lastSeen) return null;
    
    const timeSinceLastSeen = currentTime - satellite.lastSeen;
    const framesSinceLastSeen = Math.round(timeSinceLastSeen / 100);
    
    const lastRegressedPos = satellite.predictedPath.start;
    const velocity = satellite.predictedPath.velocity;
    
    return {
      x: lastRegressedPos.x + velocity.x * framesSinceLastSeen,
      y: lastRegressedPos.y + velocity.y * framesSinceLastSeen
    };
  }, []);

  const checkDeviation = useCallback((satellite, deviationThreshold) => {
    if (!satellite.predictedPath || satellite.positions.length < 2) {
      return false;
    }
    
    const { velocity, intercept } = satellite.predictedPath;
    const currentPos = satellite.positions[satellite.positions.length - 1];
    const currentT = satellite.positions.length - 1;

    const expectedX = intercept.x + velocity.x * currentT;
    const expectedY = intercept.y + velocity.y * currentT;

    const deviation = Math.sqrt(
      Math.pow(expectedX - currentPos.x, 2) + Math.pow(expectedY - currentPos.y, 2)
    );

    return deviation > deviationThreshold;
  }, []);

  const drawSatellites = useCallback((satelliteList, ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    satelliteList.forEach(satellite => {
      const positions = satellite.positions;
      if (positions.length < 1) return;
      
      const currentPos = positions[positions.length - 1];
      const state = satellite.state;
      const isLost = satellite.state === 'lost';
      
      let trailColor = 'rgba(255, 165, 0, 0.7)';
      let projectionColor = 'rgba(255, 255, 255, 0.8)';
      
      if (state === 'locked') {
        trailColor = 'rgba(255, 255, 255, 0.7)';
        projectionColor = 'rgba(255, 255, 255, 0.8)';
      } else if (state === 'confirmed') {
        trailColor = 'rgba(0, 255, 0, 0.7)';
        projectionColor = 'rgba(0, 255, 0, 0.8)';
      } else if (state === 'deviating') {
        trailColor = 'rgba(255, 255, 255, 0.7)';
        projectionColor = 'rgba(255, 0, 0, 0.8)';
      } else if (state === 'lost') {
        trailColor = 'rgba(255, 255, 255, 0.4)';
        projectionColor = 'rgba(255, 255, 255, 0.6)';
      }

      if (positions.length >= 2) {
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = isLost ? 1 : 1.5;
        ctx.beginPath();
        positions.forEach((pos, index) => {
            if (index === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        });
        ctx.stroke();
      }

      if (satellite.predictedPath && (state === 'locked' || state === 'confirmed' || state === 'deviating' || state === 'lost')) {
        ctx.setLineDash(isLost ? [4, 8] : [8, 8]);
        ctx.lineWidth = isLost ? 1.5 : 2;
        ctx.strokeStyle = projectionColor;
        const { start, end } = satellite.predictedPath;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (satellite.active && !isLost) {
        const targetSize = 8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(currentPos.x - targetSize, currentPos.y);
        ctx.lineTo(currentPos.x + targetSize, currentPos.y);
        ctx.moveTo(currentPos.x, currentPos.y - targetSize);
        ctx.lineTo(currentPos.x, currentPos.y + targetSize);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, targetSize * 0.6, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, 1.5, 0, 2 * Math.PI);
        ctx.fill();
      }

      if (isLost && satellite.predictedPath) {
        const predictedPos = getPredictedPosition(satellite, Date.now());
        if (predictedPos) {
          const targetSize = 6;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1;
          
          ctx.beginPath();
          ctx.moveTo(predictedPos.x - targetSize, predictedPos.y);
          ctx.lineTo(predictedPos.x + targetSize, predictedPos.y);
          ctx.moveTo(predictedPos.x, predictedPos.y - targetSize);
          ctx.lineTo(predictedPos.x, predictedPos.y + targetSize);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(predictedPos.x, predictedPos.y, targetSize * 0.6, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
    });
  }, [getPredictedPosition]);

  // Backend tracking function
  const detectMotionBackend = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current || !webcamReady) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Capture current frame
    ctx.drawImage(video, 0, 0);
    const frameData = canvas.toDataURL('image/jpeg', 0.8);

    try {
      // Call backend tracking function
      const response = await base44.functions.invoke('trackSatellites', {
        frameData,
        width: canvas.width,
        height: canvas.height,
        settings: trackingSettings
      });

      if (response.data.success) {
        const { tracks, totalDetections } = response.data;
        
        // Convert backend tracks to frontend satellite format
        const backendSatellites = tracks.map(track => ({
          id: track.id,
          positions: [{ x: track.x, y: track.y, brightness: 100 }],
          lastSeen: Date.now(),
          active: track.missedFrames === 0,
          predictedPath: track.predictedPath,
          state: track.confidence > 0.8 ? 'confirmed' : track.confidence > 0.5 ? 'locked' : 'observing',
          stateChangedTimestamp: Date.now(),
          confidence: track.confidence,
          speed: track.speed
        }));

        setSatellites(backendSatellites);
        drawSatellites(backendSatellites, overlayCtx);
        
        setTrackingStats({
          detected: totalDetections,
          active: tracks.filter(t => t.missedFrames === 0).length
        });

        const hasHighConfidenceTracks = tracks.some(t => t.confidence > 0.9 && t.speed > 1);
        if (hasHighConfidenceTracks) {
          playDeviationAlert();
        }
      }
    } catch (error) {
      console.error('Backend tracking error:', error);
    }
  }, [webcamReady, trackingSettings, playDeviationAlert, drawSatellites]);

  const drawMotionBoxes = useCallback((boxes, ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const currentTime = Date.now();
    
    boxes.forEach(box => {
      const elapsed = currentTime - box.startTime;
      const duration = 3000;
      const fadeStart = 2000;
      
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress >= 1) return;
      
      const shrinkDuration = 1000;
      const shrinkProgress = Math.min(elapsed / shrinkDuration, 1);
      const initialSize = 60;
      const finalSize = 20;
      const currentSize = initialSize - (initialSize - finalSize) * shrinkProgress;
      
      let opacity = 1;
      if (elapsed > fadeStart) {
        opacity = 1 - ((elapsed - fadeStart) / (duration - fadeStart));
        opacity = Math.max(0, opacity);
      }
      
      ctx.strokeStyle = `rgba(0, 255, 255, ${opacity * 0.8})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      
      ctx.strokeRect(
        box.x - currentSize / 2,
        box.y - currentSize / 2,
        currentSize,
        currentSize
      );
      
      const cornerSize = currentSize * 0.2;
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(0, 255, 255, ${opacity})`;
      
      ctx.beginPath();
      ctx.moveTo(box.x - currentSize / 2, box.y - currentSize / 2 + cornerSize);
      ctx.lineTo(box.x - currentSize / 2, box.y - currentSize / 2);
      ctx.lineTo(box.x - currentSize / 2 + cornerSize, box.y - currentSize / 2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(box.x + currentSize / 2 - cornerSize, box.y - currentSize / 2);
      ctx.lineTo(box.x + currentSize / 2, box.y - currentSize / 2);
      ctx.lineTo(box.x + currentSize / 2, box.y - currentSize / 2 + cornerSize);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(box.x - currentSize / 2, box.y + currentSize / 2 - cornerSize);
      ctx.lineTo(box.x - currentSize / 2, box.y + currentSize / 2);
      ctx.lineTo(box.x - currentSize / 2 + cornerSize, box.y + currentSize / 2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(box.x + currentSize / 2 - cornerSize, box.y + currentSize / 2);
      ctx.lineTo(box.x + currentSize / 2, box.y + currentSize / 2);
      ctx.lineTo(box.x + currentSize / 2, box.y + currentSize / 2 - cornerSize);
      ctx.stroke();
      
      ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(box.x, box.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, []);

  const updateMotionBoxes = useCallback((motionPoints, overlayCtx) => {
    const currentTime = Date.now();
    const highlightCooldown = 10000;
    const areaGridSize = 50;

    setMotionBoxes(prevBoxes => {
      let updatedBoxes = prevBoxes.filter(box => {
        return (currentTime - box.startTime) < 3000;
      });
      
      motionPoints.forEach(point => {
        const areaKey = `${Math.floor(point.x / areaGridSize)}-${Math.floor(point.y / areaGridSize)}`;
        
        if (!detectedAreasRef.current.has(areaKey)) {
          detectedAreasRef.current.add(areaKey);
          updatedBoxes.push({
            id: Date.now() + Math.random(),
            x: point.x,
            y: point.y,
            startTime: currentTime
          });
          
          setTimeout(() => {
            detectedAreasRef.current.delete(areaKey);
          }, highlightCooldown);
        }
      });
      
      drawMotionBoxes(updatedBoxes, overlayCtx);
      
      setTrackingStats({
        detected: updatedBoxes.length,
        active: updatedBoxes.length
      });
      
      return updatedBoxes;
    });
  }, [drawMotionBoxes]);

  const updateSatelliteTracking = useCallback((motionPoints, overlayCtx) => {
    const maxDistance = 75; 
    const { observationPoints, deviationThreshold, smoothingFactor } = trackingSettings;
    const currentTime = Date.now();
    
    setSatellites(prevSatellites => {
      let updatedSatellites = [...prevSatellites];
      const matchedPoints = new Set();

      updatedSatellites.forEach((satellite, index) => {
        if (!satellite.active || satellite.state === 'lost') return;
        let bestMatch = null;
        let bestDistance = maxDistance;

        motionPoints.forEach((point, pointIndex) => {
          if (matchedPoints.has(pointIndex)) return;
          
          const distance = Math.sqrt(
            Math.pow(point.x - satellite.positions[satellite.positions.length - 1].x, 2) +
            Math.pow(point.y - satellite.positions[satellite.positions.length - 1].y, 2)
          );

          if (distance < bestDistance) {
            bestMatch = { point, pointIndex };
            bestDistance = distance;
          }
        });

        if (bestMatch) {
          const newPos = bestMatch.point;
          const lastPos = satellite.positions[satellite.positions.length - 1];
          
          const smoothedPos = {
            x: lastPos.x * (1 - smoothingFactor) + newPos.x * smoothingFactor,
            y: lastPos.y * (1 - smoothingFactor) + newPos.y * smoothingFactor,
            brightness: newPos.brightness
          };

          updatedSatellites[index].positions.push(smoothedPos);
          if (updatedSatellites[index].positions.length > 50) {
             updatedSatellites[index].positions.shift(); 
          }
          updatedSatellites[index].lastSeen = currentTime;
          matchedPoints.add(bestMatch.pointIndex);
        } else {
          if (currentTime - satellite.lastSeen > 1000) {
            if (satellite.predictedPath) {
              updatedSatellites[index].state = 'lost';
              updatedSatellites[index].active = false;
              updatedSatellites[index].stateChangedTimestamp = currentTime;
            } else {
              updatedSatellites[index].active = false;
            }
          }
        }
      });

      updatedSatellites.forEach((satellite, index) => {
        if (satellite.state !== 'lost') return;
        
        const predictedPos = getPredictedPosition(satellite, currentTime);
        if (!predictedPos) return;

        let bestMatch = null;
        let bestDistance = LOST_SATELLITE_SEARCH_RADIUS;

        motionPoints.forEach((point, pointIndex) => {
          if (matchedPoints.has(pointIndex)) return;
          
          const distance = Math.sqrt(
            Math.pow(point.x - predictedPos.x, 2) +
            Math.pow(point.y - predictedPos.y, 2)
          );

          if (distance < bestDistance) {
            bestMatch = { point, pointIndex };
            bestDistance = distance;
          }
        });

        if (bestMatch) {
          const newPos = bestMatch.point;
          
          const lastPos = satellite.positions[satellite.positions.length - 1];
          const smoothedPos = {
            x: lastPos.x * (1 - smoothingFactor) + newPos.x * smoothingFactor,
            y: lastPos.y * (1 - smoothingFactor) + newPos.y * smoothingFactor,
            brightness: newPos.brightness
          };

          updatedSatellites[index].positions.push(smoothedPos);
          if (updatedSatellites[index].positions.length > 50) {
             updatedSatellites[index].positions.shift(); 
          }
          updatedSatellites[index].lastSeen = currentTime;
          updatedSatellites[index].active = true;
          
          updatedSatellites[index].state = 'locked';
          updatedSatellites[index].stateChangedTimestamp = currentTime;
          
          const trajectory = calculateTrajectory(updatedSatellites[index].positions);
          if (trajectory) {
            updatedSatellites[index].predictedPath = trajectory;
          }

          matchedPoints.add(bestMatch.pointIndex);
        }
      });

      motionPoints.forEach((point, index) => {
        if (!matchedPoints.has(index)) {
          updatedSatellites.push({
            id: Date.now() + index,
            positions: [point],
            lastSeen: currentTime,
            active: true,
            predictedPath: null,
            state: 'observing',
            stateChangedTimestamp: currentTime,
          });
        }
      });
      
      let hasNewDeviation = false;
      
      updatedSatellites.forEach(satellite => {
        if (!satellite.active && satellite.state !== 'lost') return;
        
        if (satellite.state === 'observing' && satellite.positions.length >= observationPoints) {
          const trajectory = calculateTrajectory(satellite.positions);
          if (trajectory) {
              satellite.state = 'locked';
              satellite.predictedPath = trajectory;
              satellite.stateChangedTimestamp = currentTime;
              const lockPointIndex = satellite.positions.length - 1;
              satellite.positions[lockPointIndex] = { ...satellite.positions[lockPointIndex], isLockPoint: true };
          }
        }
        
        if (satellite.active && satellite.state !== 'observing' && satellite.state !== 'lost') {
          if (checkDeviation(satellite, deviationThreshold)) {
            if (satellite.state !== 'deviating') {
                satellite.state = 'deviating';
                satellite.stateChangedTimestamp = currentTime;
                hasNewDeviation = true;
            }
          } else {
            if (satellite.state === 'deviating') {
              satellite.state = 'locked';
              satellite.stateChangedTimestamp = currentTime;
            }
            else if (satellite.state === 'locked' && currentTime - satellite.stateChangedTimestamp > CONFIRMATION_DURATION) {
              satellite.state = 'confirmed';
              satellite.stateChangedTimestamp = currentTime;
            }
          }
        }
      });

      if (hasNewDeviation) {
        playDeviationAlert();
      }

      updatedSatellites = updatedSatellites.filter(
        satellite => {
          if (satellite.state === 'lost') {
            return (currentTime - satellite.lastSeen) < LOST_SATELLITE_TIMEOUT;
          }
          return satellite.active || (currentTime - satellite.lastSeen < 5000);
        }
      );

      drawSatellites(updatedSatellites, overlayCtx);

      setTrackingStats({
        detected: updatedSatellites.length,
        active: updatedSatellites.filter(s => s.active).length
      });

      return updatedSatellites;
    });
  }, [drawSatellites, calculateTrajectory, checkDeviation, getPredictedPosition, trackingSettings, playDeviationAlert]);

  const detectMotion = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current || !webcamReady) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    ctx.drawImage(video, 0, 0);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (previousFrameRef.current) {
      const motionPoints = [];
      const { motionThreshold, brightnessThreshold } = trackingSettings;

      for (let y = 10; y < canvas.height - 10; y += 5) {
        for (let x = 10; x < canvas.width - 10; x += 5) {
          const i = (y * canvas.width + x) * 4;
          
          const currentBrightness = (currentFrame.data[i] + currentFrame.data[i + 1] + currentFrame.data[i + 2]) / 3;
          const previousBrightness = (previousFrameRef.current.data[i] + previousFrameRef.current.data[i + 1] + previousFrameRef.current.data[i + 2]) / 3;
          const diff = Math.abs(currentBrightness - previousBrightness);

          if (diff > motionThreshold && currentBrightness > brightnessThreshold) {
            motionPoints.push({ x, y, brightness: currentBrightness });
          }
        }
      }

      if (trackingMode === 'satellites') {
        updateSatelliteTracking(motionPoints, overlayCtx);
      } else {
        updateMotionBoxes(motionPoints, overlayCtx);
      }
    }

    previousFrameRef.current = currentFrame;
  }, [webcamReady, updateSatelliteTracking, updateMotionBoxes, trackingSettings, trackingMode]);

  const startTracking = async () => {
    if (trackingIntervalRef.current) return;
    
    setIsTracking(true);
    setSatellites([]);
    setMotionBoxes([]);
    detectedAreasRef.current.clear();
    
    // Only reset backend tracking if it's enabled AND we are in satellite tracking mode
    if (trackingSettings.useBackendTracking && trackingMode === 'satellites') {
      try {
        await base44.functions.invoke('trackSatellites', { reset: true });
      } catch (error) {
        console.error('Error resetting backend tracking:', error);
      }
    }
    
    // Use backend tracking function only if enabled and in satellite mode, otherwise use frontend detectMotion
    const trackingFunction = trackingSettings.useBackendTracking && trackingMode === 'satellites' ? detectMotionBackend : detectMotion;
    trackingIntervalRef.current = setInterval(trackingFunction, 100);
  };

  const stopTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    setIsTracking(false);
    setSatellites([]);
    setMotionBoxes([]);
    setTrackingStats({ detected: 0, active: 0 });
    detectedAreasRef.current.clear();
    
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
    }
    setWebcamReady(false);
    stopTracking();
  }, [stopTracking, videoUrl]);

  const resetApp = () => {
    stopWebcam();
    setSourceType(null);
    setAvailableCameras([]);
    setShowSettings(false);
    setTrackingMode('satellites');
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  if (!sourceType) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[url('/grid.svg')] bg-repeat">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-thin text-white mb-2 animate-fade-in-down">
            Astro<span className="font-light text-cyan-400">Lens</span>
          </h1>
          <p className="text-cyan-200/80 text-xl font-light mb-12 animate-fade-in-up">
            Real-time Satellite Detection & Trajectory Analysis
          </p>
          <SourceSelector onSelectWebcam={getAvailableCameras} onSelectVideo={handleVideoUpload} />
        </div>
      </div>
    );
  }

  if (sourceType === 'camera_select') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[url('/grid.svg')] bg-repeat">
        <div className="max-w-2xl mx-auto w-full">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-thin text-white mb-2">
              Select <span className="text-cyan-400 font-light">Input Source</span>
            </h1>
            <p className="text-cyan-200/80 text-lg font-light">
              Choose a camera for live analysis.
            </p>
          </div>
          <CameraSelector
            cameras={availableCameras}
            onSelectCamera={startWebcam}
            onGoBack={() => setSourceType(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <SatelliteView
        videoRef={videoRef}
        canvasRef={canvasRef}
        overlayCanvasRef={overlayCanvasRef}
        sourceType={sourceType}
      />

      {/* Xmas Mode Overlay */}
      <XmasOverlay active={trackingSettings.xmasMode} />

      {/* Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
        <Button
          onClick={resetApp}
          variant="outline"
          className="bg-black/50 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 hover:text-cyan-200 hover:border-cyan-500/70 backdrop-blur-sm transition-all duration-300"
        >
          <Settings className="w-4 h-4 mr-2" />
          Change Source
        </Button>
        
        <div className="flex gap-3 items-center">
          {webcamReady && (
            <>
              <Button
                onClick={() => {
                  setShowSettings(!showSettings);
                  if (isTracking) {
                    stopTracking();
                  }
                }}
                variant="outline"
                className="bg-black/50 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 hover:text-cyan-200 hover:border-cyan-500/70 backdrop-blur-sm transition-all duration-300"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              
              <Button
                onClick={isTracking ? stopTracking : startTracking}
                className={`backdrop-blur-sm transition-all duration-300 text-white font-semibold shadow-lg ${
                  isTracking
                    ? 'bg-red-600/80 hover:bg-red-500 border border-red-500/50 hover:border-red-400 shadow-red-500/20'
                    : 'bg-cyan-600/80 hover:bg-cyan-500 border border-cyan-500/50 hover:border-cyan-400 shadow-cyan-500/20'
                }`}
                disabled={showSettings}
              >
                {isTracking ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Stop Tracking
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Tracking
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mode Toggle */}
      {webcamReady && !isTracking && !showSettings && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <Card className="bg-black/60 border-cyan-500/20 backdrop-blur-md p-3 px-4 rounded-md">
            <div className="flex items-center gap-4 text-cyan-300">
              <span className="font-mono text-sm">Mode:</span>
              <button
                onClick={() => {
                  setTrackingMode(prevMode => prevMode === 'satellites' ? 'motion_alerts' : 'satellites');
                  if (overlayCanvasRef.current) {
                    const ctx = overlayCanvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                  }
                  setSatellites([]);
                  setMotionBoxes([]);
                  setTrackingStats({ detected: 0, active: 0 });
                  detectedAreasRef.current.clear();
                }}
                className="flex items-center gap-2 hover:text-cyan-200 transition-colors"
              >
                {trackingMode === 'satellites' ? (
                  <>
                    <ToggleLeft className="w-5 h-5" />
                    <span className="font-mono text-sm">Satellite Tracking</span>
                  </>
                ) : (
                  <>
                    <ToggleRight className="w-5 h-5 text-orange-400" />
                    <span className="font-mono text-sm text-orange-300">Motion Alerts</span>
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={trackingSettings}
        onSettingsChange={setTrackingSettings}
        onResetDefaults={() => setTrackingSettings(DEFAULT_SETTINGS)}
      />
      
      {/* Tracking Stats */}
      {isTracking && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <Card className="bg-black/60 border-cyan-500/20 backdrop-blur-md p-3 px-4 rounded-md">
            <div className="flex items-center gap-6 text-cyan-300">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-sm">
                  {trackingMode === 'satellites' ? 'Detected' : 'Alerts'}: {trackingStats.detected}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="font-mono text-sm">Active: {trackingStats.active}</span>
              </div>
              {/* Backend Tracking Indicator */}
              {trackingSettings.useBackendTracking && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="font-mono text-xs text-blue-300">Backend ML</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Webcam Status */}
      {!webcamReady && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
          <Card className="bg-black/60 border-yellow-500/20 backdrop-blur-md p-3 px-4">
            <div className="flex items-center gap-3 text-yellow-300">
              <Camera className="w-4 h-4" />
              <span className="font-light">Initializing Media Source...</span>
            </div>
          </Card>
        </div>
      )}

      {/* Instructions / Legend */}
      {webcamReady && !isTracking && !showSettings && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 max-w-xl w-full px-4">
          <Card className="bg-black/60 border-cyan-500/20 backdrop-blur-md p-4">
            <div className="text-center text-cyan-200/90 text-sm font-light mb-3">
              {sourceType === 'webcam' 
                ? 'Point camera at the night sky and press "Start Tracking".'
                : 'Press "Start Tracking" to analyze the video.'
              }
            </div>
            {trackingMode === 'satellites' ? (
              <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs font-mono border-t border-cyan-500/20 pt-3 text-center">
                <div className="text-orange-400">ORANGE: Observing</div>
                <div className="text-white">WHITE: Locked</div>
                <div className="text-green-400">GREEN: Confirmed</div>
                <div className="text-red-400 col-span-3 text-center">RED: Deviating</div>
                <div className="text-gray-400 col-span-3 text-center">DIM/DASHED: Lost (Reacquiring)</div>
              </div>
            ) : (
              <div className="text-xs font-mono border-t border-cyan-500/20 pt-3 text-center text-orange-300">
                Motion Alert Mode: Highlights detected movement with shrinking boxes and corner brackets.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}