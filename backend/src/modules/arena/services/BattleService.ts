import { inject, injectable } from 'inversify';
import { ArenaRepository } from '../repositories/ArenaRepository.js';
import { BattleSession } from '../classes/transformers/BattleSession.js';
import { aiConfig } from '#root/config/ai.js';
import { CourseRepository } from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { QUIZZES_TYPES } from '../../quizzes/types.js';
import { QuestionBankRepository } from '../../quizzes/repositories/providers/mongodb/QuestionBankRepository.js';
import { QuestionRepository } from '../../quizzes/repositories/providers/mongodb/QuestionRepository.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { STUDENT_QUESTION_TYPES } from '#root/modules/studentQuestions/types.js';
import { ProgressRepository } from '#shared/database/providers/mongo/repositories/ProgressRepository.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { SegmentContextProvider } from '#root/modules/studentQuestions/services/context/SegmentContextProvider.js';
import { ItemRepository } from '#shared/database/providers/mongo/repositories/ItemRepository.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';

@injectable()
export class BattleService {
  constructor(
    @inject('ArenaRepository') private readonly arenaRepo: ArenaRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: CourseRepository,
    @inject(QUIZZES_TYPES.QuestionBankRepo) private readonly questionBankRepo: QuestionBankRepository,
    @inject(QUIZZES_TYPES.QuestionRepo) private readonly questionRepo: QuestionRepository,
    @inject(USERS_TYPES.ProgressRepo) private readonly progressRepo: ProgressRepository,
    @inject(USERS_TYPES.EnrollmentRepo) private readonly enrollmentRepo: EnrollmentRepository,
    @inject(COURSES_TYPES.ItemRepo) private readonly itemRepo: ItemRepository,
    @inject(STUDENT_QUESTION_TYPES.SegmentContextProvider) private readonly segmentContextProvider: SegmentContextProvider
  ) {}

  public async startBattle(userId: string, courseId: string): Promise<BattleSession> {
    // End any existing active battles for this user
    const existing = await this.arenaRepo.getActiveBattle(userId);
    if (existing) {
      existing.isActive = false;
      await this.arenaRepo.saveBattle(existing);
    }

    const battle = new BattleSession({
      userId,
      courseId,
      totalPoints: 0,
      hpMilestoneProgress: 0,
      powerUpMilestoneProgress: 0,
      inventory: [],
      activePowerUps: [],
      permanentMultiplier: 1.0,
      consecutiveWins: 0,
      turnNumber: 1,
      isActive: true,
    });

    return this.arenaRepo.saveBattle(battle);
  }

  public async generateQuestion(battleId: string): Promise<any> {
    const battle = await this.arenaRepo.getBattleById(battleId);
    if (!battle || !battle.isActive) {
      throw new Error('Battle not found or inactive');
    }

    // Fetch the course to get its name and description as context for the AI
    const course = await this.courseRepo.read(battle.courseId.toString());
    if (!course) {
        throw new Error('Course not found');
    }

    let questionData;
    let usedPreGenerated = false;

    if (!usedPreGenerated) {
      let segmentContext = '';
      let completedTopics: string[] = [];
      try {
        // Find the user's enrollment to get the active courseVersionId
        const enrollments = await this.enrollmentRepo.getAllEnrollments(battle.userId.toString());
        const courseEnrollment = enrollments.find(e => e.courseId?.toString() === battle.courseId.toString() && e.status === 'ACTIVE');
        
        if (courseEnrollment && courseEnrollment.courseVersionId) {
          const versionIdStr = courseEnrollment.courseVersionId.toString();
          
          // Get completed items from ProgressRepository
          const completedItems = await this.progressRepo.getCompletedItems(
            battle.userId.toString(),
            battle.courseId.toString(),
            versionIdStr
          );

          if (completedItems && completedItems.length > 0) {
            // Filter only VIDEO items to prevent quiz metadata from polluting the AI prompt
            const videoItems = [];
            for (const itemId of completedItems) {
               try {
                 const itemEntity = await this.itemRepo.readItemById(itemId);
                 if (itemEntity && itemEntity.type === 'VIDEO') {
                    videoItems.push({ id: itemId, name: itemEntity.name || 'Unknown Topic' });
                 }
               } catch (err) {
                 // ignore missing items
               }
            }

            if (videoItems.length > 0) {
              // Pick up to 3 random completed VIDEO items to form a broader topic context
              const shuffledItems = [...videoItems].sort(() => 0.5 - Math.random());
              const selectedItems = shuffledItems.slice(0, Math.min(3, shuffledItems.length));
              
              completedTopics = selectedItems.map(item => item.name);
            
              for (const item of selectedItems) {
                const ctx = await this.segmentContextProvider.getContext({
                  segmentId: item.id,
                  courseVersionId: versionIdStr,
                });
                if (ctx) {
                  segmentContext += `\nTopic '${item.name}' Context:\n${ctx}\n`;
                }
              }
            }
          }
        }

      } catch (err) {
        console.error("Failed to fetch transcript context for arena question:", err);
      }

      let finalContextText = '';
      if (completedTopics.length > 0) {
        finalContextText = `STRICT PROGRESS SCOPING RULE: The student has ONLY completed the following topics so far: [${completedTopics.join(', ')}].
YOU ARE STRICTLY LIMITED TO THESE COMPLETED TOPICS. DO NOT GENERATE ANY QUESTIONS, ANSWERS, OR CARDS FROM UNLEARNED TOPICS OUTSIDE THIS LIST.

COMPLETED LESSON TRANSCRIPTS & TOPIC CONTEXT:
${segmentContext}`;
      } else {
        finalContextText = `COURSE DESCRIPTION:\n"${course.description}"\n\n(Infer initial introductory concepts taught in the course)`;
      }

      const prompt = `You are the AI opponent in a competitive, fast-paced strategy card game called Knowledge Clash.
The player is studying the educational course: "${course.name}".

CRITICAL RULE 1: STRICT PROGRESS SCOPING! You MUST ONLY ask questions and generate concept cards from the student's COMPLETED TOPICS: [${completedTopics.length > 0 ? completedTopics.join(', ') : 'Initial Course Concepts'}]. Do NOT use unlearned, advanced, or future topics outside of what the student has completed.
CRITICAL RULE 2: Keep it PUNCHY and CONCISE! This is a fast-paced game with a 15-second timer. The scenario/question should be short (1-2 sentences max). Card names must be 1-4 words max. Explanations must be ultra-short (1 short sentence max).
CRITICAL RULE 3: IGNORE COURSE STRUCTURE METADATA. Do NOT generate questions about "video segments", "quizzes", "modules", or "transcripts". You must generate questions about the actual EDUCATIONAL SUBJECT MATTER taught in the completed topics!

${finalContextText}

Based ONLY on the completed topics (${completedTopics.length > 0 ? completedTopics.join(', ') : 'Initial Course Concepts'}), create a question or scenario.

You MUST generate EXACTLY 5 cards in the deck. Some must be correct concepts required to solve the scenario, and others must be plausible but incorrect distractor concepts from the completed topics. Each card must include a short explanation.`;

      try {
        if (!aiConfig.GEMINI_API_KEY) {
           throw new Error("No API key");
        }
        const { GoogleGenAI, Type } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: aiConfig.GEMINI_API_KEY as string });

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                promptText: { type: Type.STRING, description: "The generated scenario or question" },
                deck: {
                    type: Type.ARRAY,
                    description: "An array of exactly 5 cards mixing correct answers and distractor concepts.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Concept Name" },
                            explanation: { type: Type.STRING, description: "Why this concept is correct or incorrect for the scenario" },
                            isCorrect: { type: Type.BOOLEAN, description: "True if this concept is part of the correct answer, False if it is a distractor" }
                        },
                        required: ["name", "explanation", "isCorrect"]
                    }
                },
                explanation: { type: Type.STRING, description: "Global learning tip for the scenario" }
            },
            required: ["promptText", "deck", "explanation"]
        };

        const response = await ai.models.generateContent({
            model: aiConfig.GEMINI_MODEL || 'gemini-3.6-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });
        
        const rawText = response.text || '';
        const jsonText = rawText.replace(/```json\n?|\n?```/g, '').trim();
        console.log("Raw JSON Text from AI:", jsonText);
        questionData = JSON.parse(jsonText);
        console.log("Parsed Question Data:", questionData);
      } catch (e: any) {
        console.error("AI Generation failed:", e);
        throw new Error(`AI Generation Error: ${e?.message || String(e)}`);
      }
    }

    let deck = questionData.deck || questionData.cards || questionData.correctCards || [];
    
    if (!deck || deck.length === 0) {
        throw new Error("AI generated an empty deck or failed to map deck data.");
    }

    const finalDeck = deck.map((c: any, index: number) => ({
        id: `c${index}`,
        name: c.name || "Unknown Concept",
        type: 'CONCEPT_ANSWER',
        description: c.explanation || "No explanation provided",
        isCorrect: c.isCorrect || false
    })).sort(() => Math.random() - 0.5);

    const sizedDeck = finalDeck.slice(0, 5);
    
    const correctConcepts = sizedDeck.filter((c: any) => c.isCorrect).map((c: any) => c.name);

    const question = {
        questionId: new Date().getTime().toString(),
        text: questionData.promptText || questionData.question || "Unknown scenario",
        correctConcepts: correctConcepts,
        deck: sizedDeck,
        explanation: questionData.explanation || "No explanation provided"
    };

    battle.currentQuestion = question;
    await this.arenaRepo.saveBattle(battle);
    return question;
  }

  public async submitAnswer(battleId: string, submittedCards: string[], powerUp?: string): Promise<any> {
    const battle = await this.arenaRepo.getBattleById(battleId);
    if (!battle || !battle.isActive) {
      throw new Error('Battle not found or inactive');
    }

    if (powerUp && battle.inventory.includes(powerUp)) {
        battle.inventory = battle.inventory.filter(p => p !== powerUp);
        battle.activePowerUps.push(powerUp);
    }

    const currentQuestion = battle.currentQuestion;
    if (!currentQuestion) {
      throw new Error('No active question in this battle');
    }

    const correctConcepts: string[] = currentQuestion.correctConcepts || [];
    
    let correctCount = 0;
    let hasMistake = false;
    
    for (const card of submittedCards) {
      if (correctConcepts.includes(card)) {
        correctCount++;
      } else {
        hasMistake = true;
      }
    }

    let multiplier = 1.0;
    let comboName = "None";
    let basePoints = 0;

    let shieldUsed = false;
    if (hasMistake && battle.activePowerUps.includes('Shield')) {
        shieldUsed = true;
        battle.activePowerUps = battle.activePowerUps.filter(p => p !== 'Shield');
    }

    if (hasMistake) {
        basePoints = shieldUsed ? 0 : -30;
        multiplier = 1.0;
        comboName = "None";
        battle.consecutiveWins = 0;
    } else {
        basePoints = 50;
        battle.consecutiveWins += 1;
        
        if (correctCount === 2) {
            multiplier = 1.5;
            comboName = "Pair";
        } else if (correctCount === 3) {
            multiplier = 2.5;
            comboName = "Three of a Kind";
        } else if (correctCount === 4) {
            multiplier = 3.0;
            comboName = "Flush";
        } else if (correctCount >= 5) {
            multiplier = 4.0;
            comboName = "Full House";
        }
        
        if (battle.activePowerUps.includes('Quick Counter') && battle.consecutiveWins >= 2) {
            battle.permanentMultiplier = 2.0;
            battle.activePowerUps = battle.activePowerUps.filter(p => p !== 'Quick Counter');
        }
    }
    
    let pointsEarned = Math.round(basePoints * multiplier);
    if (pointsEarned > 0 && battle.permanentMultiplier > 1.0) {
        pointsEarned = Math.round(pointsEarned * battle.permanentMultiplier);
    }
    
    battle.totalPoints += pointsEarned;
    if (battle.totalPoints < 0) battle.totalPoints = 0;

    let triggerHpEvent = false;
    let powerUpGranted: string | null = null;
    
    if (pointsEarned > 0) {
        battle.hpMilestoneProgress += pointsEarned;
        battle.powerUpMilestoneProgress += pointsEarned;
        
        if (battle.hpMilestoneProgress >= 250) {
            triggerHpEvent = true;
            battle.hpMilestoneProgress -= 250;
        }
        
        if (battle.powerUpMilestoneProgress >= 150) {
            battle.powerUpMilestoneProgress -= 150;
            if (battle.inventory.length < 3) {
                const powerUps = ['Shield', 'Wildcard', 'Quick Counter', 'The Joker', 'Reversal', 'Blocker'];
                powerUpGranted = powerUps[Math.floor(Math.random() * powerUps.length)];
                battle.inventory.push(powerUpGranted);
            }
        }
    }

    const actionSummary = hasMistake ? (shieldUsed ? 'Shield blocked loss' : 'Loss') : 'Win';

    battle.currentQuestion = null;

    await this.arenaRepo.saveBattle(battle);

    if (battle._id) {
      battle._id = battle._id.toString() as any;
    }

    return {
      success: true,
      actionSummary,
      comboName,
      basePoints,
      multiplier,
      permanentMultiplier: battle.permanentMultiplier,
      pointsEarned,
      milestoneChecks: {
        hpTriggered: triggerHpEvent,
        powerUpGranted,
        hpProgress: battle.hpMilestoneProgress,
        powerUpProgress: battle.powerUpMilestoneProgress
      },
      battle: {
        totalPoints: battle.totalPoints,
        inventory: battle.inventory,
        activePowerUps: battle.activePowerUps,
        isActive: battle.isActive
      }
    };
  }
}
