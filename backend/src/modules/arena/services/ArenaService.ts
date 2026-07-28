import { inject, injectable } from 'inversify';
import { ArenaRepository } from '../repositories/ArenaRepository.js';
import { UserCard } from '../classes/transformers/UserCard.js';
import { Deck } from '../classes/transformers/Deck.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { ProgressRepository } from '#shared/database/providers/mongo/repositories/ProgressRepository.js';
import { CourseRepository } from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';

@injectable()
export class ArenaService {
  constructor(
    @inject('ArenaRepository') private readonly arenaRepo: ArenaRepository,
    @inject(USERS_TYPES.EnrollmentRepo) private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: CourseRepository,
    // Using simple approach to fetch progress if ProgressRepo isn't explicitly bound to a key we know,
    // but typically it's under something like USERS_TYPES.ProgressRepo. We can just use the DB directly if needed.
  ) {}

  public async getStudentCourses(userId: string): Promise<any[]> {
    // Return courses that the user is enrolled in
    const enrollments = await this.enrollmentRepo.getAllEnrollments(userId);
    const coursePromises = enrollments.map(async (enrollment: any) => {
      const courseIdStr = enrollment.courseId?.toString() || enrollment.course?.toString();
      const versionIdStr = enrollment.courseVersionId?.toString();
      const course = await this.courseRepo.read(courseIdStr);

      let progressPercent = 0;
      let completedCount = 0;
      let totalCount = 0;

      try {
        const livePercent = Number(enrollment.percentCompleted ?? 0);
        totalCount = enrollment.contentCounts?.totalItems || 0;
        completedCount = enrollment.contentCounts?.completedItems || 0;
        progressPercent = livePercent;
      } catch (err) {
        console.error('Error calculating progress percent for arena:', err);
      }

      return {
        courseId: courseIdStr,
        courseName: course?.name || 'Unknown Course',
        versionId: versionIdStr,
        role: enrollment.role,
        status: enrollment.status,
        progressPercent: progressPercent,
        completedCount: completedCount,
        totalCount: totalCount
      };
    });
    return Promise.all(coursePromises);
  }

  public async getUserCollection(userId: string, courseId: string): Promise<UserCard[]> {
    return this.arenaRepo.getUserCards(userId, courseId);
  }

  public async getUserDeck(userId: string, courseId: string): Promise<Deck | null> {
    return this.arenaRepo.getDeck(userId, courseId);
  }

  public async saveUserDeck(userId: string, courseId: string, cards: string[]): Promise<Deck> {
    if (cards.length < 20 || cards.length > 30) {
      throw new Error('Deck must contain between 20 and 30 cards.');
    }
    
    // In a full implementation, we'd validate that the user actually owns these cards.
    // For the MVP, we assume the client sends valid cards.
    
    const deck = new Deck({ userId, courseId, cards });
    await this.arenaRepo.saveDeck(deck);
    return deck;
  }
}
