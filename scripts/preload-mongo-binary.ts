import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoBinary } from 'mongodb-memory-server-core';

(async () => {
  console.log("Verifying and downloading MongoMemoryServer binary...");
  try {
    const mms = await MongoMemoryServer.create();
    const binaryPath = await MongoBinary.getPath();
    console.log("✅ Mongo Binary successfully installed and verified @", binaryPath);
    await mms.stop();
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to install/verify MongoMemoryServer binary:", err);
    process.exit(1);
  }
})();
