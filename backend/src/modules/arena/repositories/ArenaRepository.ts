import { inject, injectable } from 'inversify';
import { Collection, Db } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { UserCard } from '../classes/transformers/UserCard.js';
import { Deck } from '../classes/transformers/Deck.js';
import { BattleSession } from '../classes/transformers/BattleSession.js';

@injectable()
export class ArenaRepository {

  constructor(
    @inject(GLOBAL_TYPES.Database) private readonly dbProvider: MongoDatabase
  ) {
  }

  public async getCollection<T extends import('mongodb').Document = import('mongodb').Document>(name: string): Promise<Collection<T>> {
    return this.dbProvider.getCollection<T>(name);
  }

  public async getUserCards(userId: string, courseId: string): Promise<UserCard[]> {
    const col = await this.getCollection<UserCard>('arena_user_cards');
    return col.find({ userId, courseId }).toArray();
  }

  public async saveUserCard(userCard: UserCard): Promise<void> {
    const col = await this.getCollection<UserCard>('arena_user_cards');
    await col.updateOne(
      { userId: userCard.userId, courseId: userCard.courseId, conceptName: userCard.conceptName },
      { $set: userCard },
      { upsert: true }
    );
  }

  public async getDeck(userId: string, courseId: string): Promise<Deck | null> {
    const col = await this.getCollection<Deck>('arena_decks');
    return col.findOne({ userId, courseId });
  }

  public async saveDeck(deck: Deck): Promise<void> {
    const col = await this.getCollection<Deck>('arena_decks');
    await col.updateOne(
      { userId: deck.userId, courseId: deck.courseId },
      { $set: deck },
      { upsert: true }
    );
  }

  public async getActiveBattle(userId: string): Promise<BattleSession | null> {
    const col = await this.getCollection<BattleSession>('arena_battle_sessions');
    return col.findOne({ userId, isActive: true, courseId: { $ne: '[object Object]' } });
  }

  public async getBattleById(battleId: string): Promise<BattleSession | null> {
    const col = await this.getCollection<BattleSession>('arena_battle_sessions');
    const { ObjectId } = await import('mongodb');
    return col.findOne({ _id: new ObjectId(battleId) });
  }

  public async saveBattle(battle: BattleSession): Promise<BattleSession> {
    const col = await this.getCollection<BattleSession>('arena_battle_sessions');
    if (battle._id) {
      const { ObjectId } = await import('mongodb');
      const { _id, ...updateData } = battle as any;
      await col.updateOne(
        { _id: new ObjectId(_id) },
        { $set: updateData }
      );
      return battle;
    } else {
      const result = await col.insertOne(battle as any);
      battle._id = result.insertedId;
      return battle;
    }
  }
}
