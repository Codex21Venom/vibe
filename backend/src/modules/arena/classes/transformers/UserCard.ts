import { ID } from '#root/shared/interfaces/models.js';
import { Expose, Transform } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { ObjectIdToString, StringToObjectId } from '#root/shared/constants/transformerConstants.js';

export class UserCard {
  @Expose()
  @JSONSchema({ title: 'Card ID', type: 'string' })
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  @JSONSchema({ title: 'User ID', type: 'string' })
  userId: string;

  @Expose()
  @JSONSchema({ title: 'Course ID', type: 'string' })
  courseId: string;

  @Expose()
  @JSONSchema({ title: 'Concept Name', type: 'string' })
  conceptName: string; // The specific concept/topic from the syllabus

  @Expose()
  @JSONSchema({ title: 'Mastery Level', type: 'number', minimum: 0, maximum: 5 })
  masteryLevel: number;

  @Expose()
  @JSONSchema({ title: 'XP', type: 'number' })
  xp: number;

  constructor(partial?: Partial<UserCard>) {
    this.userId = partial?.userId || '';
    this.courseId = partial?.courseId || '';
    this.conceptName = partial?.conceptName || '';
    this.masteryLevel = partial?.masteryLevel || 0;
    this.xp = partial?.xp || 0;
  }
}
