import dotenv from 'dotenv';
dotenv.config();

import { BattleService } from './src/modules/arena/services/BattleService.ts';

async function test() {
    const battle = new BattleService();
    try {
        console.log("Calling generateQuestion...");
        // I need to mock the dependencies or just see if there's a standalone function.
        // Wait, BattleService depends on DB and other things.
        // I can just mock it.
    } catch (e) {
        console.error(e);
    }
}
test();
