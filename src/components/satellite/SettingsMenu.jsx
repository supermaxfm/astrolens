import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Settings, Cpu } from "lucide-react";

export default function SettingsMenu({ isOpen, onClose, settings, onSettingsChange, onResetDefaults }) {
  if (!isOpen) return null;

  const handleSliderChange = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  const handleToggleChange = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  return (
    <div className="absolute top-16 right-4 z-30 w-80">
      <Card className="bg-black/80 border-cyan-500/30 backdrop-blur-md shadow-2xl shadow-cyan-500/20">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-medium text-white">Tracking Parameters</h3>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Xmas Mode Toggle */}
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-red-400">🎅</div>
                  <label htmlFor="xmasModeToggle" className="text-sm text-red-200 font-medium cursor-pointer">
                    Xmas Mode
                  </label>
                </div>
                <label htmlFor="xmasModeToggle" className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="xmasModeToggle"
                    className="sr-only peer"
                    checked={settings.xmasMode}
                    onChange={(e) => handleToggleChange('xmasMode', e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
              <p className="text-xs text-red-300/70">
                Track Santa's journey across the globe! (Press '9' for surprise)
              </p>
            </div>

            {/* Backend Tracking Toggle */}
            <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <label htmlFor="backendTrackingToggle" className="text-sm text-cyan-200 font-medium cursor-pointer">
                    Backend ML Tracking
                  </label>
                </div>
                <label htmlFor="backendTrackingToggle" className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="backendTrackingToggle"
                    className="sr-only peer"
                    checked={settings.useBackendTracking}
                    onChange={(e) => handleToggleChange('useBackendTracking', e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>
              <p className="text-xs text-cyan-300/70">
                {settings.useBackendTracking 
                  ? "Using Kalman filter & advanced algorithms on server" 
                  : "Using local browser-based tracking"}
              </p>
            </div>

            {/* Motion Sensitivity */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-cyan-200 font-medium">Motion Sensitivity</label>
                <span className="text-xs text-gray-400 font-mono">{settings.motionThreshold}</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                value={settings.motionThreshold}
                onChange={(e) => handleSliderChange('motionThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-cyan"
              />
              <p className="text-xs text-gray-500">Lower = More sensitive to faint objects</p>
            </div>

            {/* Brightness Threshold */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-cyan-200 font-medium">Brightness Threshold</label>
                <span className="text-xs text-gray-400 font-mono">{settings.brightnessThreshold}</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                step="1"
                value={settings.brightnessThreshold}
                onChange={(e) => handleSliderChange('brightnessThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-cyan"
              />
              <p className="text-xs text-gray-500">Lower = Detect much dimmer satellites (may increase noise)</p>
            </div>

            {/* Path Analysis Points */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-cyan-200 font-medium">Path Analysis Points</label>
                <span className="text-xs text-gray-400 font-mono">{settings.observationPoints}</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={settings.observationPoints}
                onChange={(e) => handleSliderChange('observationPoints', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-cyan"
              />
              <p className="text-xs text-gray-500">Higher = More accurate path prediction</p>
            </div>

            {/* Deviation Tolerance */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-cyan-200 font-medium">Path Deviation Tolerance</label>
                <span className="text-xs text-gray-400 font-mono">{settings.deviationThreshold}px</span>
              </div>
              <input
                type="range"
                min="15"
                max="150"
                step="1"
                value={settings.deviationThreshold}
                onChange={(e) => handleSliderChange('deviationThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-cyan"
              />
              <p className="text-xs text-gray-500">Higher = More tolerant of path variations</p>
            </div>

            {/* Smoothing Factor */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-cyan-200 font-medium">Position Smoothing</label>
                <span className="text-xs text-gray-400 font-mono">{(settings.smoothingFactor * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={settings.smoothingFactor}
                onChange={(e) => handleSliderChange('smoothingFactor', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-cyan"
              />
              <p className="text-xs text-gray-500">Lower = Smoother paths, Higher = More responsive</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-cyan-500/20">
            <Button
              onClick={onResetDefaults}
              variant="outline"
              size="sm"
              className="w-full bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40"
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </Card>

      <style jsx>{`
        .slider-cyan::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
        }
        .slider-cyan::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
        }
      `}</style>
    </div>
  );
}