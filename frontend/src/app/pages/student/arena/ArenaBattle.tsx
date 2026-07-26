import { useEffect, useState } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { apiClient } from "@/lib/api-client";
import { Shield, Swords, HeartPulse } from "lucide-react";
import "./arena.css";

interface ArenaBattleProps {
  courseId: string;
  onExit: () => void;
}

export default function ArenaBattle({ courseId, onExit }: ArenaBattleProps) {
  const [battleState, setBattleState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<any>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [deck, setDeck] = useState<string[]>([]);

  useEffect(() => {
    const startBattle = async () => {
      try {
        const res = await apiClient.post<any>(`/arena/${courseId}/battle/start`);
        setBattleState(res.data);
        
        // Load some mock cards for the UI, in reality would load user's actual hand/deck
        setDeck(["Concept A", "Concept B", "Concept C", "Concept D"]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    startBattle();
  }, [courseId]);

  const fetchQuestion = async () => {
    if (!battleState || question || loading) return;
    try {
      setLoading(true);
      const res = await apiClient.post<any>(`/arena/battle/${battleState._id}/question`);
      setQuestion(res.data);
      setSelectedCards([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (battleState && battleState._id && !question && !loading) {
      fetchQuestion();
    }
  }, [battleState, question]);

  const submitAnswer = async () => {
    if (!battleState || !question) return;
    try {
      setLoading(true);
      const res = await apiClient.post<any>(`/arena/battle/${battleState._id}/submit`, { cards: selectedCards });
      setBattleState(res.data.battleState);
      setQuestion(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const executeCombat = async (action: 'attack' | 'shield' | 'heal') => {
    if (!battleState) return;
    try {
      setLoading(true);
      const res = await apiClient.post<any>(`/arena/battle/${battleState._id}/combat`, { action });
      setBattleState(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = (card: string) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  if (loading && !battleState) return <div className="arena-loader">Starting Battle...</div>;

  return (
    <div className="arena-battle-container p-6 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold"><AuroraText>Knowledge Clash</AuroraText></h2>
        <button onClick={onExit} className="text-red-400 hover:text-red-300">Flee Battle</button>
      </div>

      <div className="battle-hud grid grid-cols-2 gap-8 mb-8">
        {/* Player Stats */}
        <div className="hud-panel player-panel bg-[#1a1a24] p-4 rounded-xl border border-[#a07cfe] shadow-[0_0_15px_rgba(160,124,254,0.2)]">
          <h3 className="text-xl font-semibold mb-3 text-[#a07cfe]">Player</h3>
          <div className="flex items-center gap-4 mb-2">
            <HeartPulse className="text-green-400" /> 
            <div className="w-full bg-slate-800 rounded-full h-3">
              <div className="bg-green-400 h-3 rounded-full" style={{ width: `${battleState?.playerHp}%` }}></div>
            </div>
            <span className="font-bold">{battleState?.playerHp} HP</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-bold text-yellow-400">⚡ {battleState?.playerKp} KP</span>
          </div>
        </div>

        {/* AI Stats */}
        <div className="hud-panel ai-panel bg-[#1a1a24] p-4 rounded-xl border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <h3 className="text-xl font-semibold mb-3 text-red-400">AI Opponent</h3>
          <div className="flex items-center gap-4 mb-2">
            <HeartPulse className="text-red-400" /> 
            <div className="w-full bg-slate-800 rounded-full h-3">
              <div className="bg-red-500 h-3 rounded-full" style={{ width: `${battleState?.aiHp}%` }}></div>
            </div>
            <span className="font-bold">{battleState?.aiHp} HP</span>
          </div>
        </div>
      </div>

      <div className="battle-actions flex gap-4 mb-8 justify-center">
        <button onClick={() => executeCombat('attack')} disabled={loading || (battleState?.playerKp < 20)} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold transition-all">
          <Swords /> Attack (20 KP)
        </button>
        <button onClick={() => executeCombat('shield')} disabled={loading || (battleState?.playerKp < 10)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold transition-all">
          <Shield /> Shield (10 KP)
        </button>
        <button onClick={() => executeCombat('heal')} disabled={loading || (battleState?.playerKp < 15)} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold transition-all">
          <HeartPulse /> Heal (15 KP)
        </button>
      </div>

      {question && (
        <div className="question-modal bg-[#232332] p-8 rounded-2xl border border-purple-500/30 shadow-2xl relative mt-8">
          <h3 className="text-2xl font-bold mb-6 text-white text-center">{question.text}</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            {question.options.map((opt: string, i: number) => (
              <div 
                key={i}
                onClick={() => toggleCard(opt)}
                className={`p-4 rounded-xl cursor-pointer border-2 transition-all text-center ${selectedCards.includes(opt) ? 'border-green-400 bg-green-400/10' : 'border-slate-600 bg-slate-800 hover:border-purple-400 hover:bg-purple-400/10'}`}
              >
                {opt}
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button onClick={submitAnswer} className="bg-gradient-to-r from-green-400 to-emerald-600 text-white px-10 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-all text-lg">
              Submit Answer
            </button>
          </div>
        </div>
      )}
      
      {/* Game Over Screen */}
      {battleState && !battleState.isActive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a24] p-10 rounded-2xl border-2 border-purple-500 text-center max-w-lg">
            <h2 className="text-5xl font-bold mb-4">{battleState.playerHp > 0 ? <span className="text-green-400">VICTORY</span> : <span className="text-red-500">DEFEAT</span>}</h2>
            <p className="text-xl mb-8 text-slate-300">
              {battleState.playerHp > 0 ? 'You have proven your mastery!' : 'Your knowledge needs more refinement.'}
            </p>
            <button onClick={onExit} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-full font-bold">
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
