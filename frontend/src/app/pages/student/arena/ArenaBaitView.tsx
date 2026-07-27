import { useState } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { Shield, Swords } from "lucide-react";

interface ArenaBaitViewProps {
  courseId: string;
  courseName: string;
  onStartGame: (baitedHp: number) => void;
  onBack: () => void;
  maxHp: number;
}

export default function ArenaBaitView({ courseId, courseName, onStartGame, onBack, maxHp }: ArenaBaitViewProps) {
  const [playerBait, setPlayerBait] = useState<number>(0);
  const [computerBait, setComputerBait] = useState<number | null>(null);
  const [baitConfirmed, setBaitConfirmed] = useState(false);
  const [isBaiting, setIsBaiting] = useState(false);

  const handleConfirmBait = () => {
    if (playerBait <= 0 || playerBait > maxHp) return;
    
    setIsBaiting(true);
    
    // Simulate computer bait logic
    setTimeout(() => {
      // Computer baits the exact same amount as the player
      const generatedBait = playerBait;
      
      setComputerBait(generatedBait);
      setIsBaiting(false);
      setBaitConfirmed(true);
    }, 1500);
  };

  return (
    <div className="arena-bait-container">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Bait Phase: {courseName}</h2>
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
          Back to Course Selection
        </button>
      </div>

      <div className="bait-deck-area bg-[#1a1a24] p-8 rounded-2xl border border-purple-500/30 shadow-[0_0_30px_rgba(160,124,254,0.1)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          
          {/* Player Bait Section */}
          <div className="player-bait-panel flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl border-2 border-blue-500/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-xl"></div>
            <h3 className="text-xl font-bold text-blue-400 mb-6 z-10">Your Bait</h3>
            
            {!baitConfirmed ? (
              <div className="z-10 flex flex-col items-center w-full max-w-xs">
                <input 
                  type="number" 
                  min="1"
                  max={maxHp}
                  value={playerBait || ""}
                  onChange={(e) => setPlayerBait(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-center text-3xl font-bold text-white mb-4 focus:outline-none focus:border-blue-400"
                  placeholder="0 HP"
                  disabled={isBaiting}
                />
                <p className="text-sm text-slate-400 mb-6">Available HP: {maxHp}</p>
                <button 
                  onClick={handleConfirmBait}
                  disabled={isBaiting || playerBait <= 0 || playerBait > maxHp}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBaiting ? "Locking in..." : "Confirm Bait"}
                </button>
              </div>
            ) : (
              <div className="z-10 flex flex-col items-center">
                <div className="text-6xl font-black text-blue-400 mb-4">{playerBait}</div>
                <div className="text-slate-300 font-medium">HP Locked In</div>
              </div>
            )}
          </div>

          {/* Computer Bait Section */}
          <div className="computer-bait-panel flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl border-2 border-red-500/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-red-500/10 blur-xl rounded-xl"></div>
            <h3 className="text-xl font-bold text-red-400 mb-6 z-10">Computer's Bait</h3>
            
            <div className="z-10 flex flex-col items-center justify-center h-full min-h-[150px]">
              {isBaiting ? (
                <div className="flex space-x-2 animate-pulse">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <div className="w-4 h-4 bg-red-500 rounded-full animation-delay-200"></div>
                  <div className="w-4 h-4 bg-red-500 rounded-full animation-delay-400"></div>
                </div>
              ) : baitConfirmed && computerBait !== null ? (
                <div className="flex flex-col items-center">
                  <div className="text-6xl font-black text-red-400 mb-4">{computerBait}</div>
                  <div className="text-slate-300 font-medium">HP Locked In</div>
                </div>
              ) : (
                <div className="text-slate-500 font-medium text-center">
                  Waiting for your move...
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Start Game Button (only shows when both baits are confirmed) */}
        {baitConfirmed && (
          <div className="mt-12 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
              <p className="text-lg text-slate-300 mb-2">Total Net HP Bait Pool:</p>
              <h4 className="text-4xl font-bold text-purple-400"><AuroraText>{playerBait + (computerBait || 0)} HP</AuroraText></h4>
            </div>
            
            <button 
              onClick={() => onStartGame(playerBait)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-12 rounded-full shadow-[0_0_20px_rgba(160,124,254,0.4)] hover:shadow-[0_0_30px_rgba(160,124,254,0.6)] transform hover:scale-105 transition-all text-xl flex items-center gap-3"
            >
              <Swords className="w-6 h-6" />
              START GAME
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
