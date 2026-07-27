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

@injectable()
export class BattleService {
  constructor(
    @inject('ArenaRepository') private readonly arenaRepo: ArenaRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: CourseRepository,
    @inject(QUIZZES_TYPES.QuestionBankRepo) private readonly questionBankRepo: QuestionBankRepository,
    @inject(QUIZZES_TYPES.QuestionRepo) private readonly questionRepo: QuestionRepository,
    @inject(USERS_TYPES.ProgressRepo) private readonly progressRepo: ProgressRepository,
    @inject(USERS_TYPES.EnrollmentRepo) private readonly enrollmentRepo: EnrollmentRepository,
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
      playerHp: 100,
      playerKp: 0,
      aiHp: 100,
      aiKp: 0,
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

    try {
      const questionBanks = await this.questionBankRepo.getByCourseId(course._id?.toString() || battle.courseId.toString());
      let allQuestionIds: string[] = [];
      if (questionBanks && questionBanks.length > 0) {
        questionBanks.forEach(bank => {
          if (bank.questions) {
            allQuestionIds.push(...bank.questions.map((q: any) => q.toString()));
          }
        });
      }

      if (allQuestionIds.length > 0) {
        // Shuffle question ids
        allQuestionIds.sort(() => Math.random() - 0.5);
        // Try up to 10 random questions to find a suitable one (e.g. SELECT_ONE_IN_LOT)
        for (const randomId of allQuestionIds.slice(0, 10)) {
          const q = await this.questionRepo.getById(randomId);
          if (q && q.type === 'SELECT_ONE_IN_LOT') {
            const sol = q as any;
            const correct = sol.correctLotItem;
            const incorrect = sol.incorrectLotItems || [];

            const optionsObj = [
              { text: correct.text, isCorrect: true, explanation: correct.explaination }
            ];
            incorrect.forEach((item: any) => {
              optionsObj.push({ text: item.text, isCorrect: false, explanation: item.explaination });
            });

            // Shuffle options
            optionsObj.sort(() => Math.random() - 0.5);
            const correctIndex = optionsObj.findIndex(o => o.isCorrect);

            questionData = {
              question: sol.text,
              options: optionsObj.map(o => o.text),
              correctAnswerIndex: correctIndex,
              explanation: optionsObj[correctIndex].explanation || "Correct!"
            };
            usedPreGenerated = true;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch pre-generated questions:", e);
    }

    if (!usedPreGenerated) {
      let segmentContext = '';
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
            // Pick a random completed item
            const randomItemId = completedItems[Math.floor(Math.random() * completedItems.length)];
            
            // Get context for this item using SegmentContextProvider
            const ctx = await this.segmentContextProvider.getContext({
              segmentId: randomItemId,
              courseVersionId: versionIdStr,
            });

            if (ctx) {
              segmentContext = ctx;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch transcript context for arena question:", err);
      }

      const prompt = `You are the AI opponent in a competitive strategy card game called Knowledge Clash.
The player is studying the course: "${course.name}".

CRITICAL RULE: You MUST NOT use any external knowledge. Every single fact, concept, or answer you generate must be explicitly tied to the provided course context.
Your goal is to generate a challenge question or scenario based ONLY on the concepts found in this context.
Do not ask simple trivia. Ask a scenario or relationship question.

${segmentContext ? `COURSE CONTEXT (TRANSCRIPT/LESSON INFO):\n${segmentContext}` : `COURSE DESCRIPTION:\n"${course.description}"`}

Output the result strictly as a JSON object with the following format:
{
  "question": "The question or scenario text",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correctAnswerIndex": 0,
  "explanation": "Explanation of the correct answer"
}
`;

      try {
        if (!aiConfig.GEMINI_API_KEY) {
           throw new Error("No API key");
        }
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: aiConfig.GEMINI_API_KEY as string });

        const response = await ai.models.generateContent({
            model: aiConfig.GEMINI_MODEL || 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });
        
        const rawText = response.text || '';
        const jsonText = rawText.replace(/```json\n?|\n?```/g, '').trim();
        questionData = JSON.parse(jsonText);
      } catch (e) {
        console.error("AI Generation failed:", e);
        // Fallback if AI fails
        questionData = {
          question: "Fallback Question: What is a core concept of this course?",
          options: ["CoreConcept", "IrrelevantConcept", "WrongIdea", "AnotherWrong"],
          correctAnswerIndex: 0,
          explanation: "This is a fallback question because the AI generation failed."
        };
      }
    }

    const question = {
        questionId: new Date().getTime().toString(),
        text: questionData.question,
        options: questionData.options,
        correctAnswerIndex: questionData.correctAnswerIndex,
        explanation: questionData.explanation
    };

    battle.currentQuestion = question;
    await this.arenaRepo.saveBattle(battle);
    return question;
  }

  public async submitAnswer(battleId: string, submittedCards: string[]): Promise<any> {
    const battle = await this.arenaRepo.getBattleById(battleId);
    if (!battle || !battle.isActive) {
      throw new Error('Battle not found or inactive');
    }

    const currentQuestion = battle.currentQuestion;
    if (!currentQuestion) {
      throw new Error('No active question in this battle');
    }

    const correctConcepts: string[] = currentQuestion.correctConcepts || [];
    
    // Simple evaluation: check how many correct cards were played
    let correctCount = 0;
    for (const card of submittedCards) {
      if (correctConcepts.includes(card)) {
        correctCount++;
      }
    }

    const accuracy = correctConcepts.length > 0 ? (correctCount / correctConcepts.length) : 0;
    
    // Generate KP (Knowledge Power) based on accuracy
    const kpEarned = Math.round(accuracy * 50); // Max 50 KP per correct full answer
    
    // Penalize HP for mistakes (cards played that weren't correct)
    const mistakes = submittedCards.length - correctCount;
    const hpLost = mistakes * 5;

    battle.playerKp += kpEarned;
    battle.playerHp = Math.max(0, battle.playerHp - hpLost);
    battle.currentQuestion = null; // Clear question

    await this.arenaRepo.saveBattle(battle);

    if (battle._id) {
      battle._id = battle._id.toString() as any;
    }

    return {
      accuracy,
      kpEarned,
      hpLost,
      battleState: battle
    };
  }

  public async executeCombatAction(battleId: string, actionType: 'attack' | 'shield' | 'heal'): Promise<BattleSession> {
    const battle = await this.arenaRepo.getBattleById(battleId);
    if (!battle || !battle.isActive) {
      throw new Error('Battle not found or inactive');
    }

    // Simple combat mechanics MVP
    const attackCost = 20;
    const healCost = 15;
    const shieldCost = 10;

    if (actionType === 'attack' && battle.playerKp >= attackCost) {
      battle.playerKp -= attackCost;
      battle.aiHp = Math.max(0, battle.aiHp - 25);
    } else if (actionType === 'heal' && battle.playerKp >= healCost) {
      battle.playerKp -= healCost;
      battle.playerHp = Math.min(100, battle.playerHp + 20);
    } else if (actionType === 'shield' && battle.playerKp >= shieldCost) {
      battle.playerKp -= shieldCost;
      // In a real implementation, we'd add a status effect.
    }

    // AI Turn (Simple logic)
    battle.aiKp += 10; // AI passively gains KP
    if (battle.aiKp >= attackCost) {
      battle.aiKp -= attackCost;
      battle.playerHp = Math.max(0, battle.playerHp - 15);
    }

    battle.turnNumber += 1;

    // Check win/loss
    if (battle.playerHp <= 0 || battle.aiHp <= 0) {
      battle.isActive = false;
    }

    return this.arenaRepo.saveBattle(battle);
  }
}
