import { ID } from '#root/shared/interfaces/models.js';
import { Expose, Transform } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { ObjectIdToString, StringToObjectId } from '#root/shared/constants/transformerConstants.js';

export class Deck {
  @Expose()
  @JSONSchema({ title: 'Deck ID', type: 'string' })
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
  @JSONSchema({ 
    title: 'Deck Cards', 
    type: 'array', 
    items: { type: 'string' },
    description: 'Array of concept names included in the deck' 
  })
  cards: string[];

  constructor(partial?: Partial<Deck>) {
    this.userId = partial?.userId || '';
    this.courseId = partial?.courseId || '';
    this.cards = partial?.cards || [];
  }
}
