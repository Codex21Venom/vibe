import { useState } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { Shield, Swords, Gamepad2, Info } from "lucide-react";

interface ArenaBaitViewProps {
  courseId: string;
  courseName: string;
  onStartGame: (baitedHp: number) => void;
  onBack: () => void;
  maxHp: number;
}

export default function ArenaBaitView({ courseId, courseName, onStartGame, onBack, maxHp }: ArenaBaitViewProps) {
  const [playerBait, setPlayerBait] = useState<number>(4);
  const [computerBait, setComputerBait] = useState<number | null>(null);
  const [baitConfirmed, setBaitConfirmed] = useState(false);
  const [isBaiting, setIsBaiting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmBait = () => {
    if (playerBait < 4) {
      setErrorMsg("Atleast bet with 4 hp to proceed.");
      return;
    }
    if (playerBait > maxHp) {
      setErrorMsg(`Bet cannot exceed your available HP (${maxHp} HP).`);
      return;
    }
    setErrorMsg(null);
    setIsBaiting(true);
    
    // Simulate computer bet logic
    setTimeout(() => {
      // Computer bets the exact same amount as the player
      const generatedBait = playerBait;
      
      setComputerBait(generatedBait);
      setIsBaiting(false);
      setBaitConfirmed(true);
    }, 1000);
  };

  return (
    <div className="arena-bait-container max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gamepad2 className="text-purple-400" />
          Arena Lobby: {courseName}
        </h2>
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
          &larr; Back to Course Selection
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Game Rules Section */}
        <div className="lg:col-span-2 bg-[#1a1a24]/90 p-6 rounded-2xl border border-purple-500/30 shadow-[0_0_30px_rgba(160,124,254,0.05)] overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div className="flex items-center gap-3 mb-6">
            <Info className="text-blue-400 w-6 h-6" />
            <h3 className="text-xl font-bold text-white">Card Game Rules</h3>
          </div>
          
          <div className="space-y-6 text-slate-300 text-sm">
            
            {/* Base Scoring */}
            <section>
              <h4 className="text-lg font-semibold text-purple-300 mb-2 border-b border-purple-500/20 pb-1">1. Base Scoring</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="text-green-400 font-bold">Win:</span> +50 Base Points</li>
                <li><span className="text-red-400 font-bold">Loss:</span> -30 Base Points</li>
              </ul>
            </section>

            {/* Combinations */}
            <section>
              <h4 className="text-lg font-semibold text-purple-300 mb-2 border-b border-purple-500/20 pb-1">2. Combinations & Multipliers</h4>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="pb-2">Hand</th>
                      <th className="pb-2">Requirement</th>
                      <th className="pb-2 text-right">Multiplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr><td className="py-2 font-medium">Pair</td><td className="py-2">2 matching cards</td><td className="py-2 text-right text-blue-300">1.5x</td></tr>
                    <tr><td className="py-2 font-medium">Three of a Kind</td><td className="py-2">3 matching cards (ordered)</td><td className="py-2 text-right text-green-300">2.5x</td></tr>
                    <tr><td className="py-2 font-medium">Flush</td><td className="py-2">4 cards of same suit/category</td><td className="py-2 text-right text-purple-300">3.0x</td></tr>
                    <tr><td className="py-2 font-medium">Full House</td><td className="py-2">3 of a kind + Pair</td><td className="py-2 text-right text-pink-300">4.0x</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Milestones */}
            <section>
              <h4 className="text-lg font-semibold text-purple-300 mb-2 border-b border-purple-500/20 pb-1">3. Milestone Rewards</h4>
              <ul className="list-disc pl-5 space-y-2">
                <li><span className="text-yellow-400 font-bold">Power-Up Drop:</span> Every <strong className="text-white">150 points</strong> reached, receive 1 random Power-Up (Max 3).</li>
                <li><span className="text-blue-400 font-bold">HP Regeneration:</span> Every <strong className="text-white">500 points</strong> reached, instantly earn <strong className="text-green-400">+10 HP</strong> directly to your global pool!</li>
              </ul>
            </section>

            {/* Power-Ups */}
            <section>
              <h4 className="text-lg font-semibold text-purple-300 mb-2 border-b border-purple-500/20 pb-1">4. Power-Ups Dictionary</h4>
              <ul className="space-y-2">
                <li>🛡️ <strong>Shield:</strong> Prevents point loss on the next loss.</li>
                <li>🃏 <strong>Wildcard:</strong> Substitute for any card to complete a combo.</li>
                <li>⚡ <strong>Quick Counter:</strong> Win 2 turns after activation to permanently double (2x) all future point gains.</li>
                <li>🤡 <strong>The Joker:</strong> Automatically plays the optimal combo for max points.</li>
                <li>🔄 <strong>Reversal:</strong> Reverses opponent outcome (Win becomes Loss, etc.).</li>
                <li>🛑 <strong>Blocker:</strong> Blocks 1 targeted card from opponent's hand.</li>
              </ul>
            </section>

          </div>
        </div>

        {/* Betting Section */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#1a1a24] p-6 rounded-2xl border border-purple-500/30 shadow-[0_0_30px_rgba(160,124,254,0.1)] flex flex-col h-full">
            <h3 className="text-xl font-bold text-center text-white mb-6">Establish Bet Pool</h3>
            
            <div className="flex-1 flex flex-col justify-center gap-6">
              {!baitConfirmed ? (
                <div className="flex flex-col items-center w-full">
                  <label className="text-sm font-medium text-slate-400 mb-2">Your HP Bet (Min 4, Max {maxHp})</label>
                  <input 
                    type="number" 
                    min="4"
                    max={maxHp}
                    value={playerBait || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPlayerBait(val);
                      if (val < 4) {
                        setErrorMsg("Atleast bet with 4 hp to proceed.");
                      } else if (val > maxHp) {
                        setErrorMsg(`Bet cannot exceed your available HP (${maxHp} HP).`);
                      } else {
                        setErrorMsg(null);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-center text-3xl font-bold text-white mb-2 focus:outline-none focus:border-purple-400"
                    placeholder="4 HP"
                    disabled={isBaiting}
                  />

                  {errorMsg && (
                    <div className="w-full text-amber-400 text-xs font-semibold mb-3 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/30 text-center animate-in fade-in duration-200">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  <button 
                    onClick={handleConfirmBait}
                    disabled={isBaiting || playerBait < 4 || playerBait > maxHp}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    {isBaiting ? "Locking in..." : "Confirm Bet"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-300">
                  <div className="flex w-full justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <div className="text-center">
                      <span className="block text-xs text-slate-400 mb-1">Your Bet</span>
                      <span className="text-2xl font-black text-blue-400">{playerBait}</span>
                    </div>
                    <div className="text-xl font-bold text-slate-500">vs</div>
                    <div className="text-center">
                      <span className="block text-xs text-slate-400 mb-1">AI Bet</span>
                      <span className="text-2xl font-black text-red-400">{computerBait}</span>
                    </div>
                  </div>
                  
                  <div className="text-center mt-4">
                    <p className="text-sm text-slate-400 mb-1">Total Bet Pool:</p>
                    <h4 className="text-4xl font-bold text-purple-400 mb-6">
                      <AuroraText>{playerBait + (computerBait || 0)} HP</AuroraText>
                    </h4>
                    
                    <button 
                      onClick={() => onStartGame(playerBait)}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-4 px-6 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transform hover:scale-105 transition-all text-xl flex items-center justify-center gap-3"
                    >
                      <Swords className="w-6 h-6" />
                      START MATCH
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
