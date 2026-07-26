import { Container } from 'inversify';
import { ArenaRepository } from './repositories/ArenaRepository.js';
import { ArenaService } from './services/ArenaService.js';
import { BattleService } from './services/BattleService.js';
import { ArenaController } from './controllers/ArenaController.js';

export function bindArenaModule(container: Container) {
  container.bind<ArenaRepository>('ArenaRepository').to(ArenaRepository).inSingletonScope();
  container.bind<ArenaService>('ArenaService').to(ArenaService).inSingletonScope();
  container.bind<BattleService>('BattleService').to(BattleService).inSingletonScope();
  container.bind<ArenaController>('ArenaController').to(ArenaController).inSingletonScope();
}
