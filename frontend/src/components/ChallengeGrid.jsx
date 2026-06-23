import { useState } from 'react';

export default function ChallengeGrid() {
  // Mock data representing the user's progress fetched from your DB
  const currentDayIndex = 14; 
  
  // Helper to determine status
  const getDayStatus = (dayNum) => {
    if (dayNum < currentDayIndex) return 'completed'; // For demo, assuming past is completed
    if (dayNum === currentDayIndex) return 'active';
    return 'locked';
  };

  const handleDayClick = (dayNum, status) => {
    if (status === 'locked') return;
    if (status === 'completed') {
      alert("You have already completed this day's challenge.");
      return;
    }
    
    // Logic for 'active' day
    // 1. Call backend /api/start-day to mark as 'accessed_not_submitted'
    // 2. Open Google Form URL specific to this day
    window.open(`https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?usp=pp_url&entry.12345=UserID_Here`, "_blank");
  };

  return (
    <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
      <h3 className="text-xl font-semibold mb-6">Your Journey</h3>
      
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
        {Array.from({ length: 100 }).map((_, i) => {
          const dayNum = i + 1;
          const status = getDayStatus(dayNum);
          
          let btnStyles = "aspect-square rounded-lg flex items-center justify-center font-bold text-sm transition-all duration-200";
          
          if (status === 'completed') {
            btnStyles += " bg-emerald-900/30 border border-emerald-500/50 text-emerald-400 cursor-not-allowed";
          } else if (status === 'missed') {
            btnStyles += " bg-red-900/30 border border-red-500/50 text-red-400 cursor-not-allowed opacity-50";
          } else if (status === 'locked') {
            btnStyles += " bg-gray-800 border border-gray-700 text-gray-600 cursor-not-allowed";
          } else if (status === 'active') {
            btnStyles += " bg-blue-600 hover:bg-blue-500 text-white cursor-pointer glow-blue transform hover:scale-105";
          }

          return (
            <button
              key={dayNum}
              onClick={() => handleDayClick(dayNum, status)}
              className={btnStyles}
              title={`Day ${dayNum} - ${status}`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}