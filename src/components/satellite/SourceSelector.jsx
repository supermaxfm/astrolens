import React from 'react';
import { Button } from "@/components/ui/button";
import { Satellite, Upload, Target, Video } from "lucide-react";

export default function SourceSelector({ onSelectWebcam, onSelectVideo }) {

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onSelectVideo(file);
    }
  };

  const SourceCard = ({ icon, title, description, buttonText, onSelect, onFileChange, gradient, iconColor }) => (
    <div className="bg-slate-800/50 border border-cyan-500/10 rounded-lg p-1.5 backdrop-blur-sm group transition-all duration-300 hover:border-cyan-500/30 hover:bg-slate-800/80">
      <div className="bg-slate-900/80 p-8 rounded-md h-full flex flex-col items-center text-center">
        <div className={`w-20 h-20 mb-6 flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} shadow-[0_0_20px_rgba(6,182,212,0.1)]`}>
          {icon}
        </div>
        <h3 className="text-2xl font-light text-white mb-2">{title}</h3>
        <p className="text-cyan-200/70 font-light leading-relaxed flex-grow">{description}</p>
        <div className="mt-8 w-full relative">
          {onFileChange ? (
            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept="video/*"
                onChange={onFileChange}
                className="hidden"
              />
              <div className={`w-full bg-gradient-to-r ${gradient} text-white font-light py-6 rounded-lg transition-all duration-300 transform group-hover:scale-105 shadow-lg shadow-cyan-900/30 flex items-center justify-center`}>
                {buttonText}
              </div>
            </label>
          ) : (
            <Button
              onClick={onSelect}
              className={`w-full bg-gradient-to-r ${gradient} text-white font-light py-6 rounded-lg transition-all duration-300 transform group-hover:scale-105 shadow-lg shadow-cyan-900/30`}
              size="lg"
            >
              {buttonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
      <SourceCard
        icon={<Satellite className="w-10 h-10 text-cyan-200" />}
        title="Live Sky Tracking"
        description="Use your device's camera to track objects in real-time."
        buttonText={<><Target className="w-5 h-5 mr-3" /> Start Live Tracking</>}
        onSelect={onSelectWebcam}
        gradient="from-cyan-600/80 to-blue-700/80"
      />
      <SourceCard
        icon={<Upload className="w-10 h-10 text-cyan-200" />}
        title="Analyze Video File"
        description="Process a pre-recorded video of the night sky."
        buttonText={<><Video className="w-5 h-5 mr-3" /> Select Video File</>}
        onFileChange={handleFileChange}
        gradient="from-cyan-600/80 to-blue-700/80"
      />
    </div>
  );
}