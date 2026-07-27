import { useState, useEffect, useRef } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { Swords, Shield, Zap, RefreshCw, Crosshair, Play } from "lucide-react";
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

type RoundState = 'intro' | 'playing' | 'resolving' | 'game_over';

// --- Mock Data Generator ---
const generateMockHand = (): Card[] => {
  return [
    { id: 'c1', name: 'Concept A', type: 'CONCEPT_ANSWER', description: 'A distractor concept.', isCorrect: false },
    { id: 'c2', name: 'Concept B', type: 'CONCEPT_ANSWER', description: 'The correct concept.', isCorrect: true },
    { id: 'c3', name: 'Concept C', type: 'CONCEPT_ANSWER', description: 'Another distractor.', isCorrect: false },
    { id: 'c4', name: 'Concept D', type: 'CONCEPT_ANSWER', description: 'Yet another distractor.', isCorrect: false },
    { id: 'p1', name: '2x Score', type: 'POWER_UP', description: 'Doubles points if correct.', powerUpType: 'MULTIPLIER_2X' },
  ].sort(() => Math.random() - 0.5); // Shuffle
};

export default function ArenaBattle({ courseId, baitedHp, onExit }: ArenaBattleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
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
  
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [playedCard, setPlayedCard] = useState<Card | null>(null);
  const [computerPlayedCard, setComputerPlayedCard] = useState<Card | null>(null);
  
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
      startNewRound(1);
    } catch (err) {
      console.warn("Fullscreen API failed or blocked", err);
      setIsFullscreen(true); // Proceed anyway
      startNewRound(1);
    }
  };

  const startNewRound = (roundNum: number) => {
    if (roundNum > 10 || playerHP <= 0 || computerHP <= 0) {
      setRoundState('game_over');
      return;
    }
    
    setCurrentRound(roundNum);
    setPlayerHand(generateMockHand());
    setQuestion({ promptText: `Mock Scenario for Round ${roundNum}: Which concept solves this problem?` });
    setSelectedCard(null);
    setPlayedCard(null);
    setComputerPlayedCard(null);
    setTimer(15);
    setRoundState('playing');
  };

  // Timer Effect
  useEffect(() => {
    if (roundState === 'playing' && timer > 0) {
      timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
    } else if (roundState === 'playing' && timer === 0) {
      // Auto-play a random card if timer runs out
      const randomCard = playerHand.find(c => c.type === 'CONCEPT_ANSWER') || playerHand[0];
      handlePlayCard(randomCard);
    }
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer, roundState, playerHand]);

  const handlePlayCard = (card: Card) => {
    if (roundState !== 'playing') return;
    
    setRoundState('resolving');
    setPlayedCard(card);
    
    // Simulate Computer AI playing a card
    // 75% chance to play correct card if it exists, otherwise random
    const isCompCorrect = Math.random() < 0.75;
    const compCard: Card = {
      id: 'comp_c1',
      name: isCompCorrect ? 'Correct Concept' : 'Wrong Concept',
      type: 'CONCEPT_ANSWER',
      description: 'Computer AI Choice',
      isCorrect: isCompCorrect
    };
    
    setTimeout(() => {
      setComputerPlayedCard(compCard);
      resolveRound(card, compCard);
    }, 1000); // 1 second dramatic pause before reveal
  };

  const resolveRound = (pCard: Card, cCard: Card) => {
    let pDamage = 0;
    let cDamage = 0;
    let pScoreDelta = 0;
    let cScoreDelta = 0;
    
    let resultMsg = "";

    // Resolve Player
    if (pCard.isCorrect) {
      pScoreDelta += 100;
      cDamage += Math.max(10, Math.floor(baitedHp * 0.1)); // Deal 10% of baited HP as damage
      resultMsg += "You answered correctly! ";
    } else {
      pDamage += Math.max(10, Math.floor(baitedHp * 0.1));
      resultMsg += "You answered incorrectly. ";
    }

    // Resolve Computer
    if (cCard.isCorrect) {
      cScoreDelta += 100;
      pDamage += Math.max(10, Math.floor(baitedHp * 0.1));
    } else {
      cDamage += Math.max(10, Math.floor(baitedHp * 0.1));
    }
    
    // Apply stats
    setPlayerHP(prev => Math.max(0, prev - pDamage));
    setComputerHP(prev => Math.max(0, prev - cDamage));
    setPlayerScore(prev => prev + pScoreDelta);
    setComputerScore(prev => prev + cScoreDelta);
    setRoundResultText(resultMsg);

    // Wait 3 seconds, then next round
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
        
        {roundState === 'playing' && (
          <div className="animate-pop-in flex flex-col items-center">
            <div className={`timer-circle ${timer <= 5 ? 'warning' : ''}`}>
              {timer}
            </div>
            <div className="question-board">
              <h3 className="text-2xl font-semibold text-white">{question?.promptText}</h3>
            </div>
          </div>
        )}

        {roundState === 'resolving' && (
          <div className="resolution-area animate-pop-in">
            {/* Player's Played Card */}
            <div className="flex flex-col items-center">
              <span className="text-green-400 font-bold mb-4">You Played</span>
              <div className={`playing-card ${playedCard?.type === 'POWER_UP' ? 'powerup-card' : 'concept-card'}`}>
                <div className="card-type">{playedCard?.type === 'POWER_UP' ? 'Power-Up' : 'Concept'}</div>
                <div className="card-title text-xl mt-4">{playedCard?.name}</div>
                <div className={`mt-auto font-bold ${playedCard?.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {playedCard?.isCorrect ? 'CORRECT' : 'INCORRECT'}
                </div>
              </div>
            </div>

            <div className="text-4xl font-black text-white px-8">VS</div>

            {/* Computer's Played Card */}
            <div className="flex flex-col items-center">
              <span className="text-red-400 font-bold mb-4">AI Played</span>
              {computerPlayedCard ? (
                <div className="playing-card concept-card animate-pop-in">
                  <div className="card-type">Concept</div>
                  <div className="card-title text-xl mt-4">{computerPlayedCard.name}</div>
                  <div className={`mt-auto font-bold ${computerPlayedCard.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                    {computerPlayedCard.isCorrect ? 'CORRECT' : 'INCORRECT'}
                  </div>
                </div>
              ) : (
                <div className="playing-card concealed"></div>
              )}
            </div>
          </div>
        )}

        {roundState === 'resolving' && computerPlayedCard && (
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
                  setSelectedCard(card);
                  handlePlayCard(card); // Instantly play for now
                }
              }}
              className={`playing-card ${card.type === 'POWER_UP' ? 'powerup-card' : 'concept-card'} 
                         ${selectedCard?.id === card.id ? 'selected' : ''} 
                         ${roundState !== 'playing' ? 'disabled' : ''}`}
            >
              <div className="card-type text-left w-full mb-2">
                {card.type === 'POWER_UP' ? (
                  <span className="flex items-center gap-1 text-amber-500"><Zap size={12}/> Power-Up</span>
                ) : 'Concept'}
              </div>
              <div className="card-title">{card.name}</div>
              <p className="text-xs text-slate-400 mt-2 leading-tight flex-1">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
