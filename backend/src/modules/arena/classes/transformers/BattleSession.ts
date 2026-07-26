import { ID } from '#root/shared/interfaces/models.js';
import { Expose, Transform, Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { ObjectIdToString, StringToObjectId } from '#root/shared/constants/transformerConstants.js';

export class BattleSession {
  @Expose()
  @JSONSchema({ title: 'Battle ID', type: 'string' })
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
  @JSONSchema({ title: 'Player HP', type: 'number' })
  playerHp: number;

  @Expose()
  @JSONSchema({ title: 'Player KP', type: 'number' })
  playerKp: number;

  @Expose()
  @JSONSchema({ title: 'AI HP', type: 'number' })
  aiHp: number;

  @Expose()
  @JSONSchema({ title: 'AI KP', type: 'number' })
  aiKp: number;

  @Expose()
  @JSONSchema({ title: 'Turn Number', type: 'number' })
  turnNumber: number;

  @Expose()
  @JSONSchema({ title: 'Is Active', type: 'boolean' })
  isActive: boolean;

  @Expose()
  @JSONSchema({ title: 'Current Question', type: 'object' })
  currentQuestion?: any;

  @Expose()
  @Type(() => Date)
  @JSONSchema({ title: 'Created At', type: 'string', format: 'date-time' })
  createdAt: Date;

  constructor(partial?: Partial<BattleSession>) {
    this.userId = partial?.userId || '';
    this.courseId = partial?.courseId || '';
    this.playerHp = partial?.playerHp ?? 100;
    this.playerKp = partial?.playerKp ?? 0;
    this.aiHp = partial?.aiHp ?? 100;
    this.aiKp = partial?.aiKp ?? 0;
    this.turnNumber = partial?.turnNumber ?? 1;
    this.isActive = partial?.isActive ?? true;
    this.currentQuestion = partial?.currentQuestion || null;
    this.createdAt = new Date();
  }
}
