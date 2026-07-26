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
      const course = await this.courseRepo.read(courseIdStr);
      return {
        courseId: courseIdStr,
        courseName: course?.name || 'Unknown Course',
        versionId: enrollment.courseVersionId?.toString(),
        role: enrollment.role,
        status: enrollment.status
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
