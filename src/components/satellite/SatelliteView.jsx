import React from 'react';

export default function SatelliteView({ videoRef, canvasRef, overlayCanvasRef, sourceType }) {
  return (
    <div className="absolute inset-0">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay={sourceType === 'webcam'}
        playsInline
        muted
        loop={sourceType === 'video'}
        controls={sourceType === 'video'}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        onLoadedMetadata={(e) => {
          if (sourceType === 'webcam') {
            e.target.play().catch(console.error);
          }
        }}
      />
      
      {/* Hidden canvas for motion detection */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />
      
      {/* Overlay canvas for trajectory visualization */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          zIndex: 10
        }}
      />
    </div>
  );
}