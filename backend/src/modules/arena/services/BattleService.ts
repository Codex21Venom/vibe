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

  private async getUserCourseProgress(userId: string, courseId: string): Promise<{ progressPercent: number; courseEnrollment: any; completedItemIds: string[] }> {
    const enrollments = await this.enrollmentRepo.getAllEnrollments(userId.toString());
    const courseEnrollment = enrollments.find(
      e => (e.courseId?.toString() === courseId || (e as any).course?.toString() === courseId) && e.status === 'ACTIVE'
    );

    let progressPercent = Number(courseEnrollment?.percentCompleted ?? 0);
    let completedItemIds: string[] = [];

    try {
      const userObjId = new (await import('mongodb')).ObjectId(userId);
      const courseObjId = new (await import('mongodb')).ObjectId(courseId);

      const progressCol = await this.arenaRepo.getCollection('progress');
      const completedDocs = await progressCol.find({
        $or: [{ userId: userObjId }, { userId: userId }],
        courseId: { $in: [courseObjId, courseId] },
        isCompleted: true
      }).toArray();

      completedItemIds = completedDocs.map((doc: any) => doc.itemId?.toString()).filter(Boolean);

    } catch (err) {
      console.error('Error computing course progress in BattleService:', err);
    }

    return { progressPercent, courseEnrollment, completedItemIds };
  }

  public async startBattle(userId: string, courseId: string): Promise<BattleSession> {
    const { progressPercent } = await this.getUserCourseProgress(userId, courseId);
    if (progressPercent < 30) {
      throw new Error(`You must complete at least 30% of the course to enter the Arena. (Current progress: ${progressPercent}%)`);
    }

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

    const { progressPercent, courseEnrollment, completedItemIds } = await this.getUserCourseProgress(
      battle.userId.toString(),
      battle.courseId.toString()
    );

    if (progressPercent < 30) {
      throw new Error(`You must complete at least 30% of the course to enter the Arena. (Current progress: ${progressPercent}%)`);
    }

    // Fetch the course to get its name and description as context for the AI
    const course = await this.courseRepo.read(battle.courseId.toString());
    if (!course) {
        throw new Error('Course not found');
    }

    let questionData;
    let usedPreGenerated = false;

    // CACHE CHECK: If we have pre-generated questions in cache, pop one
    if (battle.cachedQuestions && battle.cachedQuestions.length > 0) {
        const question = battle.cachedQuestions.pop();
        battle.currentQuestion = question;
        await this.arenaRepo.saveBattle(battle);
        return question;
    }

    if (!usedPreGenerated) {
      let segmentContext = '';
      let completedTopics: string[] = [];
      try {
        if (courseEnrollment && courseEnrollment.courseVersionId) {
          const versionIdStr = courseEnrollment.courseVersionId.toString();
          
          // Use the exact completed items that contributed to the progress percent
          const completedItems = completedItemIds;

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
              // Pick up to 4 random completed VIDEO items to form topic context
              const shuffledItems = [...videoItems].sort(() => 0.5 - Math.random());
              const selectedItems = shuffledItems;
              
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

      const QUESTION_STYLES = [
        {
          name: 'Scenario Analysis',
          instruction: 'Create a practical problem scenario where the student must choose the exact concepts required to solve it.'
        },
        {
          name: 'Fill In The Blank',
          instruction: 'Create a statement with a crucial concept missing, asking the student to select the card that correctly fills the blank.'
        },
        {
          name: 'Concept Comparison',
          instruction: 'Create a question contrasting key concepts, asking the student to select the true matching concepts.'
        },
        {
          name: 'Diagnostic Logic',
          instruction: 'Describe an error, bug, or suboptimal output and ask the user to select the cards containing the corrective concepts.'
        },
        {
          name: 'Practical Application',
          instruction: 'Formulate an execution-focused task requiring the selection of correct implementation steps/tools.'
        },
        {
          name: 'Principle Identification',
          instruction: 'Present a specific outcome requirement and ask the student to pick the fundamental principles that govern it.'
        }
      ];
      const selectedStyle = QUESTION_STYLES[Math.floor(Math.random() * QUESTION_STYLES.length)];

      let finalContextText = '';
      if (completedTopics.length > 0) {
        finalContextText = `STRICT PROGRESS BOUNDARY (${progressPercent}% Progress Completed):
The student has currently completed ${progressPercent}% of the course. The completed topics available are: [${completedTopics.join(', ')}].
YOU ARE STRICTLY RESTRICTED TO THESE COMPLETED TOPICS ONLY (${progressPercent}% boundary). DO NOT ASK QUESTIONS OR GENERATE CARDS FOR UNLEARNED/FUTURE CONCEPTS OUTSIDE THIS LIST.

COMPLETED LESSON TRANSCRIPTS & CONTEXT:
${segmentContext}`;
      } else {
        finalContextText = `STRICT PROGRESS BOUNDARY (${progressPercent}% Progress Completed):
COURSE DESCRIPTION:\n"${course.description}"\n\n(Only use introductory topics from the first ${progressPercent}% of this course)`;
      }

      const prompt = `You are the AI opponent in a competitive, fast-paced strategy card game called Knowledge Clash.
The player is studying the educational course: "${course.name}".

CRITICAL RULE 1: STRICT SCOPING BY PROGRESS (${progressPercent}%)! You MUST ONLY ask questions and generate concept cards from the student's COMPLETED TOPICS: [${completedTopics.length > 0 ? completedTopics.join(', ') : 'Topics from first ' + progressPercent + '% of course'}]. Under NO circumstances should you ask about advanced topics beyond the student's current ${progressPercent}% progress!
CRITICAL RULE 2: QUESTION VARIETY & STYLE! Use the following question style for this turn:
-> QUESTION STYLE: ${selectedStyle.name}
-> STYLE INSTRUCTION: ${selectedStyle.instruction}
CRITICAL RULE 3: Keep it extremely PUNCHY and CONCISE! The entire question must be readable in under 10 seconds. Scenario/question: 1 short sentence max. Card names: 1-4 words max. Explanations: 1 short sentence max.
CRITICAL RULE 4: IGNORE COURSE STRUCTURE METADATA. Do NOT ask about "video segments", "quizzes", "modules", or "transcripts". Focus strictly on the actual EDUCATIONAL SUBJECT MATTER taught!

${finalContextText}

Based ONLY on the completed topics within ${progressPercent}% course progress, create a ${selectedStyle.name} question or scenario.

You MUST generate a batch of 5 varied questions in JSON format to minimize future API calls.
For each question, randomly output either a standard Multiple Choice or a 'FILL IN THE BLANK TYPE' question.
For each question, you MUST generate EXACTLY 5 cards in the deck. Some must be correct concepts required to solve the scenario, and others must be plausible but incorrect distractor concepts from the completed topics. Each card must include a short explanation.`;

      try {
        if (!aiConfig.GEMINI_API_KEY) {
           throw new Error("No API key");
        }
        const { GoogleGenAI, Type } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: aiConfig.GEMINI_API_KEY as string });

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                batch: {
                    type: Type.ARRAY,
                    description: "An array of 5 diverse questions.",
                    items: {
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
                    }
                }
            },
            required: ["batch"]
        };

        const abortController = new AbortController();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("LLM Request Timeout (>45s)")), 45000);
        });

        const response: any = await Promise.race([
            ai.models.generateContent({
                model: aiConfig.GEMINI_MODEL || 'gemini-3.6-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            }),
            timeoutPromise
        ]);
        
        const rawText = response.text || '';
        const jsonText = rawText.replace(/```json\n?|\n?```/g, '').trim();
        console.log("Raw JSON Text from AI:", jsonText);
        questionData = JSON.parse(jsonText);
        console.log("Parsed Question Data:", questionData);
      } catch (e: any) {
        console.error("AI Generation failed or timed out:", e?.message || e);
        console.log("Falling back to offline cache...");
        try {
            questionData = { batch: [await this.fetchCachedQuestion(completedTopics, battle.courseId.toString())] };
        } catch (fallbackErr: any) {
            console.error("Fallback also failed:", fallbackErr);
            throw new Error("AI Generation failed and no suitable fallback questions were found.");
        }
      }
    }

    const batch = questionData.batch || [];
    if (!batch || batch.length === 0) {
        throw new Error("AI generated an empty batch or failed to map batch data.");
    }

    const formattedQuestions = batch.map((q: any) => {
        const deck = q.deck || q.cards || q.correctCards || [];
        const finalDeck = deck.map((c: any, index: number) => ({
            id: `c${index}`,
            name: c.name || "Unknown Concept",
            type: 'CONCEPT_ANSWER',
            description: c.explanation || "No explanation provided",
            isCorrect: c.isCorrect || false
        })).sort(() => Math.random() - 0.5).slice(0, 5);
        
        const correctConcepts = finalDeck.filter((c: any) => c.isCorrect).map((c: any) => c.name);
        
        return {
            questionId: new Date().getTime().toString() + Math.random().toString(36).substr(2, 5),
            text: q.promptText || q.question || "Unknown scenario",
            correctConcepts: correctConcepts,
            deck: finalDeck,
            explanation: q.explanation || "No explanation provided"
        };
    });

    if (!battle.cachedQuestions) battle.cachedQuestions = [];
    battle.cachedQuestions.push(...formattedQuestions);
    
    const question = battle.cachedQuestions.pop();
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
        const pIdx = battle.inventory.indexOf(powerUp);
        if (pIdx !== -1) {
            battle.inventory.splice(pIdx, 1);
        }
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

    if (battle.activePowerUps.includes('The Joker')) {
        battle.activePowerUps = battle.activePowerUps.filter(p => p !== 'The Joker');
        correctCount = correctConcepts.length;
        hasMistake = false;
    }

    if (battle.activePowerUps.includes('Wildcard')) {
        battle.activePowerUps = battle.activePowerUps.filter(p => p !== 'Wildcard');
        correctCount += 1;
    }

    if (battle.activePowerUps.includes('Reversal')) {
        battle.activePowerUps = battle.activePowerUps.filter(p => p !== 'Reversal');
    }

    if (battle.activePowerUps.includes('Blocker')) {
        battle.activePowerUps = battle.activePowerUps.filter(p => p !== 'Blocker');
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
    
    // NON-NEGATIVE POINTS FLOOR RULE:
    // If user points are 0 or user points - penalty <= 0, points remain 0.
    // Penalty is only applied if user points - penalty > 0.
    if (pointsEarned < 0) {
        if (battle.totalPoints + pointsEarned <= 0) {
            pointsEarned = -battle.totalPoints; // Only deduct remaining points down to 0
            battle.totalPoints = 0;
        } else {
            battle.totalPoints += pointsEarned;
        }
    } else {
        battle.totalPoints += pointsEarned;
    }

    let triggerHpEvent = false;
    let powerUpGranted: string | null = null;
    
    if (pointsEarned > 0) {
        battle.hpMilestoneProgress += pointsEarned;
        battle.powerUpMilestoneProgress += pointsEarned;
        
        while (battle.hpMilestoneProgress >= 250) {
            triggerHpEvent = true;
            battle.hpMilestoneProgress -= 250;
        }
        
        // Power-Up Milestone: Every 100 points reached (Max 3 inventory slots)
        while (battle.powerUpMilestoneProgress >= 100) {
            battle.powerUpMilestoneProgress -= 100;
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

  private async fetchCachedQuestion(completedTopics: string[], courseId: string): Promise<any> {
    try {
        const questionsCol = await this.arenaRepo.getCollection('questions');
        let pipeline: any[] = [];
        
        if (completedTopics && completedTopics.length > 0) {
            pipeline = [
                {
                    $match: {
                        'topic': { $in: completedTopics }
                    }
                },
                { $sample: { size: 1 } }
            ];
        } else {
            // If no completed topics, fall back to any question in the current course
            // If the schema doesn't explicitly store courseId on questions, we try matching common fields or just sample
            pipeline = [
                {
                    $match: {
                        $or: [
                            { courseId: courseId },
                            { "source.courseId": courseId },
                            { courseId: new (await import('mongodb')).ObjectId(courseId) }
                        ]
                    }
                },
                { $sample: { size: 1 } }
            ];
        }
        
        const results = await questionsCol.aggregate(pipeline).toArray();
        if (results && results.length > 0) {
            const fallbackQ = results[0];
            
            // Map to the generated AI structure
            const correctCard = {
                name: fallbackQ.correctLotItem?.text || fallbackQ.correctLotItem?.title || "Correct Concept",
                explanation: fallbackQ.correctLotItem?.explaination || "Correct answer from database",
                isCorrect: true
            };
            
            const distractors = (fallbackQ.incorrectLotItems || []).map((item: any) => ({
                name: item.text || item.title || "Incorrect Concept",
                explanation: item.explaination || "Distractor from database",
                isCorrect: false
            }));
            
            return {
                promptText: fallbackQ.text || "Fallback Question",
                deck: [correctCard, ...distractors],
                explanation: fallbackQ.hint || "No explanation"
            };
        }
        
        // Final fallback if course matching fails: just grab ANY random question so the game doesn't crash
        const anyResults = await questionsCol.aggregate([{ $sample: { size: 1 } }]).toArray();
        if (anyResults && anyResults.length > 0) {
             const fallbackQ = anyResults[0];
             const correctCard = {
                name: fallbackQ.correctLotItem?.text || fallbackQ.correctLotItem?.title || "Correct Concept",
                explanation: fallbackQ.correctLotItem?.explaination || "Correct answer from database",
                isCorrect: true
             };
             const distractors = (fallbackQ.incorrectLotItems || []).map((item: any) => ({
                name: item.text || item.title || "Incorrect Concept",
                explanation: item.explaination || "Distractor from database",
                isCorrect: false
             }));
             return {
                promptText: fallbackQ.text || "Fallback Question",
                deck: [correctCard, ...distractors],
                explanation: fallbackQ.hint || "No explanation"
             };
        }

        throw new Error("No matching fallback questions found.");
    } catch (e) {
        console.error("Error fetching cached question:", e);
        throw e;
    }
  }
}
