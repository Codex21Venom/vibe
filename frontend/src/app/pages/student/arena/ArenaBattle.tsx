import { useState, useEffect, useRef } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { Swords, Shield, Zap, RefreshCw, Crosshair, Play } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import "./arena.css";

interface ArenaBattleProps {
  courseId: string;
  baitedHp: number;
  onExit: () => void;
}

// --- Types ---
type CardType = 'CONCEPT_ANSWER' | 'POWER_UP';
type PowerUpType = 'MULTIPLIER_2X' | 'SHIELD' | 'CARD_REDRAW' | 'STEAL_SNIPER';

interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
  powerUpType?: PowerUpType;
  isCorrect?: boolean;
}

interface QuestionCard {
  promptText: string;
}

type RoundState = 'intro' | 'loading' | 'playing' | 'resolving' | 'game_over';

// Mock data generator removed

export default function ArenaBattle({ courseId, baitedHp, onExit }: ArenaBattleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [battleId, setBattleId] = useState<string | null>(null);
  
  // Game State
  const [currentRound, setCurrentRound] = useState(1);
  const [roundState, setRoundState] = useState<RoundState>('intro');
  const [timer, setTimer] = useState(15);
  
  const [playerHP, setPlayerHP] = useState(baitedHp);
  const [computerHP, setComputerHP] = useState(baitedHp);
  
  const [playerScore, setPlayerScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [question, setQuestion] = useState<QuestionCard | null>(null);
  
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [playedCards, setPlayedCards] = useState<Card[]>([]);
  const [computerPlayedCards, setComputerPlayedCards] = useState<Card[]>([]);
  const [computerComboName, setComputerComboName] = useState<string>("");
  const [computerComboMultiplier, setComputerComboMultiplier] = useState<number>(1);
  const [comboName, setComboName] = useState<string>("");
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  
  const [roundResultText, setRoundResultText] = useState("");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const battleContainerRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---
  const startMatch = async () => {
    try {
      if (battleContainerRef.current && !document.fullscreenElement) {
        await battleContainerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
      setRoundState('loading');
      
      const response = await apiClient.post(`/arena/${courseId}/battle/start`);
      const newBattleId = response.data._id;
      setBattleId(newBattleId);
      
      startNewRound(1, newBattleId);
    } catch (err) {
      console.warn("API failed or blocked", err);
      alert("Failed to start match from server.");
      setIsFullscreen(false);
      if (document.fullscreenElement) {
         document.exitFullscreen();
      }
      if (onExit) onExit();
      return;
    }
  };

  const startNewRound = async (roundNum: number, bId?: string) => {
    if (roundNum > 10 || playerHP <= 0 || computerHP <= 0) {
      setRoundState('game_over');
      return;
    }
    
    setCurrentRound(roundNum);
    setSelectedCards([]);
    setPlayedCards([]);
    setComboName("");
    setComboMultiplier(1);
    setComputerPlayedCards([]);
    setComputerComboName("");
    setComputerComboMultiplier(1);
    setTimer(15);
    setRoundState('loading');
    
    const activeBattleId = bId || battleId;
    if (activeBattleId) {
      try {
         const qRes = await apiClient.post(`/arena/battle/${activeBattleId}/question`);
         const { text, deck } = qRes.data;
         setQuestion({ promptText: text });
         setPlayerHand(deck);
      } catch (err) {
         console.error("Failed fetching question", err);
         alert("Failed to fetch round from API. Match aborted.");
         setRoundState('game_over');
         return;
      }
    } else {
       alert("No active battle found. Match aborted.");
       setRoundState('game_over');
       return;
    }

    setRoundState('playing');
  };

  // Timer Effect
  useEffect(() => {
    if (roundState === 'playing' && timer > 0) {
      timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
    } else if (roundState === 'playing' && timer === 0) {
      // Auto-play selected or a random card if timer runs out
      if (selectedCards.length > 0) {
        handlePlayCards(selectedCards);
      } else {
        const randomCard = playerHand.find(c => c.type === 'CONCEPT_ANSWER') || playerHand[0];
        handlePlayCards(randomCard ? [randomCard] : []);
      }
    }
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer, roundState, playerHand, selectedCards]);

  const handlePlayCards = async (cards: Card[]) => {
    if (roundState !== 'playing') return;
    
    setRoundState('resolving');
    setPlayedCards(cards);
    
    let submitRes: any = null;
    
    if (battleId && cards.length > 0) {
      try {
         const response = await apiClient.post(`/arena/battle/${battleId}/submit`, { cards: cards.map(c => c.name || 'Timeout') });
         submitRes = response.data;
         setComboName(submitRes.comboName || "Combo Broken!");
         setComboMultiplier(submitRes.multiplier || 0);
      } catch (e) {
         console.error("Failed submitting answer", e);
      }
    }
    
    // Simulate Computer AI playing a combination (Game Theory)
    const correctCards = playerHand.filter(c => c.isCorrect);
    const distractors = playerHand.filter(c => !c.isCorrect);
    
    let compCards: Card[] = [];
    const rand = Math.random();
    
    if (rand < 0.1) {
        // 10% chance: Total blunder (plays 1-2 distractors)
        compCards = distractors.slice(0, Math.max(1, Math.floor(Math.random() * distractors.length)));
    } else if (rand < 0.4) {
        // 30% chance: Safe play (plays 1 correct card)
        compCards = correctCards.slice(0, 1);
    } else if (rand < 0.7) {
        // 30% chance: Greedy but flawed (plays all correct + 1 distractor by mistake)
        if (distractors.length > 0) {
            compCards = [...correctCards, distractors[0]];
        } else {
            compCards = correctCards;
        }
    } else {
        // 30% chance: Perfect optimal combo (plays ALL correct cards)
        compCards = correctCards;
    }
    
    if (compCards.length === 0) compCards = [playerHand[0]]; // fallback
    
    setTimeout(() => {
      setComputerPlayedCards(compCards);
      resolveRound(cards, compCards, submitRes);
    }, 1000); // 1 second dramatic pause before reveal
  };

  const resolveRound = (pCards: Card[], cCards: Card[], submitRes: any) => {
    let pDamage = 0;
    let cDamage = 0;
    let pScoreDelta = 0;
    let cScoreDelta = 0;
    
    let resultMsg = "";

    // Resolve Player via API response
    if (submitRes) {
      pScoreDelta += submitRes.kpEarned || 0;
      pDamage += submitRes.hpLost || 0;
      
      if (submitRes.multiplier > 0) {
        cDamage += Math.max(10, Math.floor(baitedHp * 0.1)) * submitRes.multiplier;
        resultMsg += `You struck with ${submitRes.comboName}! `;
      } else {
        resultMsg += "Your combo failed! ";
      }
    } else {
      resultMsg += "Timeout! ";
      pDamage += 10;
    }

    // Resolve Computer (Frontend Calculation)
    const cCorrectCount = cCards.filter(c => c.isCorrect).length;
    const cHasMistake = cCards.some(c => !c.isCorrect);
    
    let cMultiplier = 1;
    let cComboName = "Single Strike";
    
    if (!cHasMistake) {
        if (cCorrectCount === 2) { cMultiplier = 1.5; cComboName = "Pair Combo!"; }
        else if (cCorrectCount === 3) { cMultiplier = 2.0; cComboName = "Three of a Kind!"; }
        else if (cCorrectCount === 4) { cMultiplier = 2.5; cComboName = "Four of a Kind!"; }
        else if (cCorrectCount >= 5) { cMultiplier = 3.0; cComboName = "Full House Mastery!"; }
        else if (cCorrectCount === 0) { cMultiplier = 0; cComboName = "Miss"; }
    } else {
        cMultiplier = 0;
        cComboName = "Combo Broken!";
    }
    
    setComputerComboName(cComboName);
    setComputerComboMultiplier(cMultiplier);
    
    if (cMultiplier > 0) {
        cScoreDelta += Math.round((cCorrectCount / 5) * 50 * cMultiplier); // Approx AI score
        pDamage += Math.max(10, Math.floor(baitedHp * 0.1)) * cMultiplier;
    } else {
        cDamage += 10; // AI takes penalty for broken combo
    }
    
    // Apply stats
    setPlayerHP(prev => Math.max(0, prev - pDamage));
    setComputerHP(prev => Math.max(0, prev - cDamage));
    setPlayerScore(prev => prev + pScoreDelta);
    setComputerScore(prev => prev + cScoreDelta);
    setRoundResultText(resultMsg);

    // Wait 3.5 seconds, then next round
    setTimeout(() => {
      startNewRound(currentRound + 1);
    }, 3500);
  };

  const exitMatch = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    onExit();
  };

  // --- Renders ---
  
  if (roundState === 'intro') {
    return (
      <div ref={battleContainerRef} className="arena-battle-container p-6 w-full max-w-6xl mx-auto min-h-[70vh] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-[#1a1a24] p-12 rounded-2xl border border-purple-500/30 shadow-[0_0_50px_rgba(160,124,254,0.15)] text-center max-w-2xl w-full">
            <Swords className="w-20 h-20 text-purple-400 mx-auto mb-6" />
            <h3 className="text-4xl font-bold text-white mb-4">Ready for Combat</h3>
            
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 mb-8">
              <p className="text-lg text-slate-300 mb-2">Total Match HP Pool:</p>
              <div className="text-5xl font-black text-amber-400">{baitedHp * 2} HP</div>
              <p className="text-sm text-slate-500 mt-2">(You: {baitedHp} | AI: {baitedHp})</p>
            </div>
            
            <p className="text-slate-400 text-lg mb-8">
              Survive 10 rounds of strict knowledge evaluation. Correct answers deal damage, wrong answers drain your HP.
            </p>

            <div className="flex justify-center gap-4">
              <button onClick={startMatch} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-4 px-10 rounded-full text-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105">
                <Play className="fill-current" /> START MATCH
              </button>
              <button onClick={onExit} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 px-8 rounded-full font-bold transition-colors">
                Retreat
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (roundState === 'game_over') {
    const isWin = playerHP > 0 && computerHP <= 0 || playerScore > computerScore;
    
    return (
      <div ref={battleContainerRef} className="game-fullscreen-container justify-center items-center p-8">
        <div className="bg-[#1a1a24] p-12 rounded-2xl border-2 shadow-2xl max-w-3xl w-full text-center" style={{ borderColor: isWin ? '#34d399' : '#ef4444' }}>
          <h2 className="text-5xl font-black mb-4" style={{ color: isWin ? '#34d399' : '#ef4444' }}>
            {isWin ? 'VICTORY ACHIEVED' : 'DEFEAT'}
          </h2>
          
          <div className="grid grid-cols-2 gap-8 my-10">
            <div className="bg-slate-800 p-6 rounded-xl">
              <h4 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Your Final Score</h4>
              <div className="text-4xl font-bold text-white">{playerScore}</div>
              <div className="text-green-400 mt-2">{playerHP} HP Remaining</div>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl">
              <h4 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">AI Final Score</h4>
              <div className="text-4xl font-bold text-white">{computerScore}</div>
              <div className="text-red-400 mt-2">{computerHP} HP Remaining</div>
            </div>
          </div>
          
          <p className="text-slate-300 mb-8">
            Knowledge Mastery Dashboard integration will be available here.
          </p>

          <button onClick={exitMatch} className="bg-purple-600 hover:bg-purple-500 text-white py-3 px-10 rounded-full font-bold text-lg">
            Return to Arena Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={battleContainerRef} className="game-fullscreen-container">
      {/* Top Area: Computer Opponent */}
      <div className="game-top-area">
        <div className="flex justify-between items-center w-full max-w-4xl px-8 mb-4">
          <div className="flex flex-col items-start">
            <span className="text-red-400 font-bold tracking-widest uppercase mb-1">AI Dealer</span>
            <span className="text-white font-mono text-xl">{computerScore} PTS</span>
          </div>
          
          <div className="flex flex-col items-end w-1/3">
            <div className="flex justify-between w-full mb-1">
              <span className="text-slate-400 text-sm">HP</span>
              <span className="text-red-400 font-bold">{computerHP} / {baitedHp}</span>
            </div>
            <div className="game-hp-bar">
              <div className="game-hp-fill" style={{ width: `${(computerHP / baitedHp) * 100}%` }}></div>
            </div>
          </div>
        </div>
        
        {/* Computer concealed hand */}
        <div className="hand-container scale-75">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="playing-card concealed"></div>
          ))}
        </div>
      </div>

      {/* Middle Area: Play Table & Question */}
      <div className="game-middle-area z-10">
        <div className="absolute top-4 font-bold text-slate-500 tracking-widest">
          ROUND {currentRound} / 10
        </div>
        
        {roundState === 'loading' && (
          <div className="animate-pop-in flex flex-col items-center justify-center mt-12">
            <RefreshCw className="animate-spin text-purple-400 w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold text-white">Generating Question from AI...</h3>
          </div>
        )}

        {roundState === 'playing' && (
          <div className="animate-pop-in flex flex-col items-center">
            <div className={`timer-circle ${timer <= 5 ? 'warning' : ''}`}>
              {timer}
            </div>
            <div className="question-board">
              <h3 className="text-2xl font-semibold text-white">{question?.promptText}</h3>
            </div>
            <div className="flex justify-center w-full mt-6">
              <button 
                 onClick={() => handlePlayCards(selectedCards)}
                 disabled={selectedCards.length === 0}
                 className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-12 rounded-full text-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all hover:scale-105"
              >
                 Play Combination ({selectedCards.length})
              </button>
            </div>
          </div>
        )}

        {roundState === 'resolving' && (
          <div className="resolution-area animate-pop-in">
            {/* Player's Played Cards */}
            <div className="flex flex-col items-center">
              <span className="text-green-400 font-bold mb-4 uppercase tracking-widest">You Played</span>
              {comboName && comboMultiplier > 1 && (
                <div className="text-amber-400 font-black text-2xl animate-pulse mb-2">{comboName} (x{comboMultiplier})</div>
              )}
              {comboMultiplier === 0 && (
                <div className="text-red-500 font-black text-2xl animate-pulse mb-2">{comboName}</div>
              )}
              <div className="flex gap-2 justify-center">
                {playedCards.map(c => (
                  <div key={c.id} className={`playing-card scale-75 origin-top ${c.type === 'POWER_UP' ? 'powerup-card' : 'concept-card'}`}>
                    <div className="card-type">{c.type === 'POWER_UP' ? 'Power-Up' : 'Concept'}</div>
                    <div className="card-title text-sm mt-4 line-clamp-2" title={c.name}>{c.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-4xl font-black text-white px-8">VS</div>

            {/* Computer's Played Cards */}
            <div className="flex flex-col items-center">
              <span className="text-red-400 font-bold mb-4 uppercase tracking-widest">AI Played</span>
              {computerComboName && computerComboMultiplier > 1 && (
                <div className="text-amber-400 font-black text-2xl animate-pulse mb-2">{computerComboName} (x{computerComboMultiplier})</div>
              )}
              {computerComboMultiplier === 0 && (
                <div className="text-red-500 font-black text-2xl animate-pulse mb-2">{computerComboName}</div>
              )}
              {computerPlayedCards.length > 0 ? (
                <div className="flex gap-2 justify-center">
                  {computerPlayedCards.map(c => (
                    <div key={c.id} className={`playing-card scale-75 origin-top ${c.type === 'POWER_UP' ? 'powerup-card' : 'concept-card'} animate-pop-in`}>
                      <div className="card-type">{c.type === 'POWER_UP' ? 'Power-Up' : 'Concept'}</div>
                      <div className="card-title text-sm mt-4 line-clamp-2" title={c.name}>{c.name}</div>
                      <div className={`mt-auto text-xs font-bold ${c.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {c.isCorrect ? 'CORRECT' : 'INCORRECT'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="playing-card concealed scale-75"></div>
              )}
            </div>
          </div>
        )}

        {roundState === 'resolving' && computerPlayedCards.length > 0 && (
          <div className="absolute bottom-4 bg-slate-900/80 px-6 py-2 rounded-full border border-slate-700 animate-pop-in">
            <span className="text-white font-bold">{roundResultText}</span>
          </div>
        )}
      </div>

      {/* Bottom Area: Player Hand */}
      <div className="game-bottom-area z-20">
        <div className="flex justify-between items-end w-full max-w-5xl px-8 mb-6">
          <div className="flex flex-col w-1/3">
            <div className="flex justify-between w-full mb-1">
              <span className="text-slate-400 text-sm">HP</span>
              <span className="text-green-400 font-bold">{playerHP} / {baitedHp}</span>
            </div>
            <div className="game-hp-bar">
              <div className="game-hp-fill player" style={{ width: `${(playerHP / baitedHp) * 100}%` }}></div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-green-400 font-bold tracking-widest uppercase mb-1">Player (You)</span>
            <span className="text-white font-mono text-xl">{playerScore} PTS</span>
          </div>
        </div>

        <div className="hand-container pb-4">
          {playerHand.map((card) => (
            <div 
              key={card.id} 
              onClick={() => {
                if (roundState === 'playing') {
                  if (selectedCards.some(sc => sc.id === card.id)) {
                     setSelectedCards(selectedCards.filter(sc => sc.id !== card.id));
                  } else {
                     setSelectedCards([...selectedCards, card]);
                  }
                }
              }}
              className={`playing-card ${card.type === 'POWER_UP' ? 'powerup-card' : 'concept-card'} 
                         ${selectedCards.some(sc => sc.id === card.id) ? 'selected ring-4 ring-purple-500 transform -translate-y-4' : ''} 
                         ${roundState !== 'playing' ? 'disabled' : ''} transition-all duration-200`}
            >
              <div className="card-type text-left w-full mb-2">
                {card.type === 'POWER_UP' ? (
                  <span className="flex items-center gap-1 text-amber-500"><Zap size={12}/> Power-Up</span>
                ) : 'Concept'}
              </div>
              <div className="card-title line-clamp-2" title={card.name}>{card.name}</div>
              <p className="text-xs text-slate-400 mt-2 leading-tight flex-1 line-clamp-4" title={card.description}>
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
