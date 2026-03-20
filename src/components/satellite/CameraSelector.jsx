import React from 'react';
import { Button } from "@/components/ui/button";
import { Camera, ArrowLeft, Smartphone, Monitor } from "lucide-react";

export default function CameraSelector({ cameras, onSelectCamera, onGoBack }) {
  const getCameraIcon = (label) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('environment')) {
      return <Smartphone className="w-6 h-6 text-green-400" />;
    } else if (lowerLabel.includes('front') || lowerLabel.includes('user') || lowerLabel.includes('face')) {
      return <Smartphone className="w-6 h-6 text-blue-400" />;
    } else if (lowerLabel.includes('usb') || lowerLabel.includes('external') || lowerLabel.includes('webcam')) {
      return <Monitor className="w-6 h-6 text-purple-400" />;
    }
    return <Camera className="w-6 h-6 text-cyan-400" />;
  };

  const getCameraName = (device, index) => {
    return device.label || `Camera ${index + 1}`;
  };

  const getCameraDescription = (label) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('environment')) {
      return "Rear-facing camera (Ideal for sky tracking)";
    } else if (lowerLabel.includes('front') || lowerLabel.includes('user') || lowerLabel.includes('face')) {
      return "Front-facing camera";
    }
    return "Generic video device";
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center mb-6">
        <Button
          onClick={onGoBack}
          variant="outline"
          className="bg-black/50 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 hover:text-cyan-200 hover:border-cyan-500/70 backdrop-blur-sm transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {cameras.length === 0 ? (
        <div className="bg-slate-800/50 border border-red-500/20 rounded-lg p-8 text-center backdrop-blur-sm">
            <Camera className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h3 className="text-xl font-semibold text-white mb-2">No Cameras Found</h3>
            <p className="text-red-200/80">
              Please check camera connections and browser permissions.
            </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {cameras.map((camera, index) => (
            <div 
              key={camera.deviceId} 
              className="bg-slate-800/50 border border-cyan-500/10 rounded-lg p-4 backdrop-blur-sm group transition-all duration-300 hover:border-cyan-500/30 hover:bg-slate-800/80 cursor-pointer"
              onClick={() => onSelectCamera(camera.deviceId)}
            >
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex-shrink-0 bg-slate-900/70 rounded-full flex items-center justify-center border border-cyan-500/10 group-hover:border-cyan-500/20">
                    {getCameraIcon(camera.label || '')}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">
                      {getCameraName(camera, index)}
                    </h3>
                    <p className="text-sm text-cyan-200/70 font-light">
                      {getCameraDescription(camera.label || '')}
                    </p>
                  </div>
                   <Button
                      className="bg-cyan-600/80 hover:bg-cyan-500 text-white font-light rounded-lg transition-all duration-300 transform group-hover:scale-105"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCamera(camera.deviceId);
                      }}
                    >
                      Select
                    </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Default Camera Option */}
      <div className="border-t border-cyan-500/10 pt-4">
         <div 
            className="bg-slate-800/30 border border-cyan-500/5 rounded-lg p-4 backdrop-blur-sm group transition-all duration-300 hover:border-cyan-500/20 hover:bg-slate-800/50 cursor-pointer"
            onClick={() => onSelectCamera(null)}
          >
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex-shrink-0 bg-slate-900/70 rounded-full flex items-center justify-center border border-cyan-500/10 group-hover:border-cyan-500/20">
                  <Camera className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Auto-Select Default</h3>
                  <p className="text-sm text-cyan-200/70 font-light">
                    Let the browser choose the best camera.
                  </p>
                </div>
                 <Button
                    variant="outline"
                    className="bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 hover:text-cyan-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCamera(null);
                    }}
                  >
                    Use Default
                  </Button>
            </div>
          </div>
      </div>
    </div>
  );
}