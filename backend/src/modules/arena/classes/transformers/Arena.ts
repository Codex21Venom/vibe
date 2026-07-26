import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, IsObject, IsArray, IsNumber } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ObjectId } from 'mongodb';
import { ID, ObjectIdToString, StringToObjectId } from '#root/shared/index.js';

export enum MatchStatusEnum {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export class ArenaCard {
  @Expose()
  concept: string;

  @Expose()
  explanation: string;
}

export class ArenaQuestion {
  @Expose()
  question: string;

  @Expose()
  @Type(() => ArenaCard)
  correct_cards: ArenaCard[];

  @Expose()
  @Type(() => ArenaCard)
  distractor_cards: ArenaCard[];
}

export class ArenaMatch {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  userId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  courseId: ID;

  @Expose()
  @IsEnum(MatchStatusEnum)
  status: MatchStatusEnum;

  @Expose()
  @IsNumber()
  hp: number;

  @Expose()
  @IsNumber()
  kp: number;

  @Expose()
  @IsNumber()
  questionsAnswered: number;

  @Expose()
  @Type(() => ArenaQuestion)
  currentQuestion?: ArenaQuestion;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  constructor(
    userId: ID,
    courseId: ID,
    status: MatchStatusEnum = MatchStatusEnum.IN_PROGRESS,
    hp: number = 100,
    kp: number = 0,
    questionsAnswered: number = 0
  ) {
    this.userId = new ObjectId(userId);
    this.courseId = new ObjectId(courseId);
    this.status = status;
    this.hp = hp;
    this.kp = kp;
    this.questionsAnswered = questionsAnswered;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
