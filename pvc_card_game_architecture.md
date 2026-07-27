# 🎮 Technical Architecture & System Prompt Specification: Player vs. Computer 10-Round Educational Card Game

---

## 1. Executive System Overview

The **Player vs. Computer (PvC) Educational Card Game** is a 10-round interactive assessment engine. The **AI Dealer** dynamically generates question cards strictly based on the learner's completed course topics, distributes answer and power-up cards randomly, evaluates player actions, manages real-time HP betting, runs an adaptive computer opponent, and generates a comprehensive **Knowledge Mastery Dashboard** at the end of the match.

```text
       +-------------------------------------------------------+
       |                   LEARNER PROFILE                     |
       |  (Course: Full Stack, Topics: JS, MERN, Auth)         |
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |               DYNAMIC AI DEALER (LLM)                 |
       |  - Strict Question Generation based on Topics         |
       |  - Generates Correct & Distractor Concept Cards       |
       |  - Deals Hands (4 Concept Cards + 1 Power-Up)         |
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |               GAME STATE ENGINE MACHINE               |
       |  - 10-Round Simultaneous Play Loop                    |
       |  - Real-time HP Betting & Submission State Management |
       +-------------+---------------------------+-------------+
                     |                           |
                     v                           v
       +---------------------------+ +---------------------------+
       |       HUMAN PLAYER        | |   ADAPTIVE COMPUTER AI    |
       |  - Selects Card + HP Bet  | |  - Score-based Accuracy   |
       |  - Timed Inputs (15s)     | |  - Dynamic HP Betting     |
       +-------------+-------------+ +-------------+-------------+
                     |                           |
                     +-------------+-------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |              EVALUATION & KNOWLEDGE ENGINE            |
       |  - Real-time HP Tracking & Damage Resolution          |
       |  - Point Allocation & Speed Bonuses                   |
       |  - Instant AI Explanation Feedback                    |
       |  - Comprehensive Knowledge Dashboard                  |
       +-------------------------------------------------------+
```

---

## 2. Core Data Structures & Interfaces

```typescript
// --- 1. Learner Profile & Module Progress ---
interface LearnerProfile {
  learnerId: string;
  courseName: string; // e.g., "Full Stack Web Development"
  completedTopics: string[]; // e.g., ["basic_js", "mern_stack", "basic_auth"]
  difficultyPreferences: 'easy' | 'intermediate' | 'hard';
  masteryScores: Record<string, number>; // Domain -> score (0 to 100)
}

// --- 2. Card Definitions ---
type CardType = 'CONCEPT_ANSWER' | 'POWER_UP';
type PowerUpType = 'MULTIPLIER_2X' | 'SHIELD' | 'CARD_REDRAW' | 'STEAL_SNIPER';

interface Card {
  id: string;
  name: string; // e.g., "Bcrypt", "async/await", "2x Score"
  type: CardType;
  domainTag?: string; // e.g., "authentication", "javascript", "sorting"
  description: string;
  explanation?: string; // Explanation of why this concept is correct or incorrect for the scenario
  powerUpType?: PowerUpType;
}

// --- 3. Question Definition ---
interface QuestionCard {
  id: string;
  domainTag: string;
  promptText: string; // The generated scenario or question
  correctConceptIds: string[]; // IDs mapping to 'correct_cards' concepts
  distractorConceptIds: string[]; // IDs mapping to 'distractor_cards' concepts
  explanation: string; // Global learning tip for the scenario
}

// --- 4. Round Action Submission ---
interface PlayerRoundAction {
  playerId: string;
  selectedAnswerCardId: string;
  selectedPowerUpCardId?: string;
  wagerHP: number; // Real-time HP bet for the round
  submissionTimeSeconds: number; // e.g., 4.2 seconds
}

// --- 5. Game State Machine ---
interface GameState {
  currentRound: number; // 1 to 10
  maxRounds: number; // 10
  playerHand: Card[];
  computerHand: Card[];
  activeQuestion: QuestionCard | null;
  playerScore: number;
  computerScore: number;
  playerHP: number; // Starts at e.g., 100
  computerHP: number; // Starts at e.g., 100
  roundHistory: RoundResult[];
  domainPerformance: Record<string, { correct: number; total: number }>;
}

interface RoundResult {
  round: number;
  question: QuestionCard;
  playerAction: PlayerRoundAction;
  computerAction: PlayerRoundAction;
  playerPointsEarned: number;
  computerPointsEarned: number;
  playerHPLost: number;
  computerHPLost: number;
  playerCorrect: boolean;
  computerCorrect: boolean;
}
```

---

## 3. Complete Implementation System Prompt

*(This prompt can be directly provided to an AI model or built into the backend game engine to execute the entire 10-round game demo).*

```text
SYSTEM PROMPT: PvC 10-ROUND EDUCATIONAL CARD GAME ENGINE

YOU ARE THE AI DEALER AND GAME ENGINE for a 10-Round Player vs Computer Educational Card Game called "Knowledge Clash: Quick Duel".

### OBJECTIVE:
Evaluate the learner's knowledge strictly across their completed course topics through a 10-round dynamic card game with real-time HP betting against an adaptive Computer AI.

---

### INPUT FORMAT EXPECTED:
{
  "learnerId": "L-1029",
  "course_name": "Full Stack Web Development",
  "completed_topics": ["basic_js", "mern_stack", "basic_auth", "basic_ml", "basic_sorting"],
  "difficulty": "intermediate",
  "initial_hp": 100
}

---

### GAMEPLAY RULES & PIPELINE:

1. INITIAL SETUP & STRICT QUESTION GENERATION:
   - For each round, generate a Question Card strictly using the following logic:
     "Based on the course '{request.course_name}' and specifically the following completed topics: {', '.join(request.completed_topics)}. Create a {request.difficulty} difficulty question or scenario. The 'correct_cards' should be the concepts required to answer the question or solve the scenario. The 'distractor_cards' should be other plausible concepts from the completed topics that are incorrect for this specific scenario. Each card should include an explanation of why it is correct or incorrect."
   - Generate a deck of Concept Answer Cards (using the generated 'correct_cards' and 'distractor_cards') and 4 types of Power-Up Cards:
     * [⚡ 2x Score]: Doubles points if correct.
     * [🛡️ Shield]: Prevents HP loss if wrong.
     * [🔄 Redraw]: Swaps 2 hand cards.
     * [🎯 Steal]: Steals 30 pts from opponent if they answer correctly.
   - Deal 5 random cards (4 Concept Cards + 1 Power-Up Card) to the Player and Computer.

2. ROUND EXECUTION LOOP (Rounds 1 through 10):
   For each round r = 1..10:
     a. Display Question Card with a 15-second timer.
     b. Accept Player Card submission + Optional Power-Up + Real-time HP Bet (Wager).
     c. Calculate Computer AI submission using Adaptive Logic:
        - P(Correct) = clamp(0.75 - 0.002 * (CompScore - PlayerScore), 0.50, 0.90)
        - Dynamic HP Wager based on internal confidence level.
        - Strategic Power-Up selection based on the score and HP gap.
     d. Reveal both cards and HP wagers simultaneously.
     e. Resolve HP Bets and Award Points:
        - HP Resolution: If a player answers incorrectly, they lose their wagered HP. If they answer correctly, they deal their wagered HP as damage to the opponent's HP (unless the opponent uses a Shield).
        - Correct Answer: +100 pts.
        - Speed Bonus (< 5s): +20 pts.
        - Apply Power-Up multipliers/effects.
     f. Output the card-specific explanation of why the played card is correct or incorrect for the given scenario.
     g. Discard played cards and refill hands back to 5.
     h. Terminate game early if either player's HP reaches 0.

3. MATCH FINALIZATION & KNOWLEDGE REPORT:
   After Round 10 (or if HP reaches 0):
   - Declare Match Winner (Player vs Computer) based on remaining HP and Total Score.
   - Calculate Overall Mastery Percentage: (Correct Answers / Total Rounds Played) * 100%.
   - Provide Domain-by-Domain Mastery breakdown table (Domain, Accuracy %, Performance Grade).
   - Generate 3 bullet points of Targeted Revision Recommendations for weak areas.
```

---

## 4. Verification & Demo Walkthrough Plan

To verify this architecture in a live prototype:
1. **State & Betting Machine Unit Test**: Simulate automated rounds ensuring hands auto-refill to 5 cards, HP bets are properly deducted or dealt as damage, and score calculations respect power-ups (`2x`, `Shield`, `Steal`).
2. **Strict LLM Generation Test**: Validate that questions strictly follow the generation prompt format, deriving context solely from the `course_name` and `completed_topics`, with exact output mappings for `correct_cards` and `distractor_cards` containing their respective validation explanations.
3. **Dashboard Test**: Ensure domain accuracy sums match the round results and appropriately handle early game termination via HP depletion.
