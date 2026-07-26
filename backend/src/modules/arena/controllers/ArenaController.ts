import { JsonController, Get, Post, Body, Req, Param, Authorized, CurrentUser } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { ArenaService, BattleService } from '../services/index.js';
import { Request } from 'express';

@JsonController('/arena')
@injectable()
export class ArenaController {
  constructor(
    @inject('ArenaService') private readonly arenaService: ArenaService,
    @inject('BattleService') private readonly battleService: BattleService
  ) {}

  @Get('/courses')
  @Authorized()
  public async getCourses(@CurrentUser() user: any) {
    if (!user || !user._id) throw new Error('Unauthorized');
    return this.arenaService.getStudentCourses(user._id.toString());
  }

  @Get('/:courseId/collection')
  @Authorized()
  public async getCollection(@CurrentUser() user: any, @Param('courseId') courseId: string) {
    return this.arenaService.getUserCollection(user._id.toString(), courseId);
  }

  @Get('/:courseId/deck')
  @Authorized()
  public async getDeck(@CurrentUser() user: any, @Param('courseId') courseId: string) {
    return this.arenaService.getUserDeck(user._id.toString(), courseId);
  }

  @Post('/:courseId/deck')
  @Authorized()
  public async saveDeck(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Body() body: { cards: string[] }
  ) {
    return this.arenaService.saveUserDeck(user._id.toString(), courseId, body.cards);
  }

  @Post('/:courseId/battle/start')
  @Authorized()
  public async startBattle(@CurrentUser() user: any, @Param('courseId') courseId: string) {
    return this.battleService.startBattle(user._id.toString(), courseId);
  }

  @Post('/battle/:battleId/question')
  @Authorized()
  public async generateQuestion(@Param('battleId') battleId: string) {
    return this.battleService.generateQuestion(battleId);
  }

  @Post('/battle/:battleId/submit')
  @Authorized()
  public async submitAnswer(
    @Param('battleId') battleId: string,
    @Body() body: { cards: string[] }
  ) {
    return this.battleService.submitAnswer(battleId, body.cards);
  }

  @Post('/battle/:battleId/combat')
  @Authorized()
  public async executeCombat(
    @Param('battleId') battleId: string,
    @Body() body: { action: 'attack' | 'shield' | 'heal' }
  ) {
    return this.battleService.executeCombatAction(battleId, body.action);
  }
}
