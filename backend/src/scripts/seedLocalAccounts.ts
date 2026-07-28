import "dotenv/config";
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";

async function main() {
  const dbDir = path.resolve(process.cwd(), ".data/mongo_db");
  const DB_NAME = process.env.DB_NAME || "vibe";

  let uri = process.env.DB_URL || process.env.MONGO_URI;

  if (process.env.USE_MEMORY_DB === "true" || !uri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const memoryServer = await MongoMemoryServer.create({
      instance: {
        dbPath: dbDir,
        storageEngine: "wiredTiger",
      },
    });
    uri = memoryServer.getUri();
  }

  console.log(`Connecting to MongoDB at ${uri}...`);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCollection = db.collection("users");

    const defaultUsers = [
      {
        email: "admin@vibe.com",
        passwordRaw: "admin123",
        firstName: "Admin",
        lastName: "User",
        roles: "admin",
      },
      {
        email: "teacher@vibe.com",
        passwordRaw: "teacher123",
        firstName: "Teacher",
        lastName: "User",
        roles: "teacher",
      },
      {
        email: "student@vibe.com",
        passwordRaw: "student123",
        firstName: "Student",
        lastName: "User",
        roles: "student",
      },
    ];

    for (const u of defaultUsers) {
      const hashedPassword = await bcrypt.hash(u.passwordRaw, 10);
      const userPayload = {
        email: u.email,
        password: hashedPassword,
        firstName: u.firstName,
        lastName: u.lastName,
        roles: u.roles,
        authProvider: "local",
        updatedAt: new Date(),
      };

      const result = await usersCollection.updateOne(
        { email: u.email },
        {
          $set: userPayload,
          $setOnInsert: {
            createdAt: new Date(),
            firebaseUID: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          },
        },
        { upsert: true }
      );

      console.log(`✅ User ${u.email} (role: ${u.roles}) ready! (Password: ${u.passwordRaw})`);
    }

  } catch (err) {
    console.error("Error seeding local accounts:", err);
  } finally {
    await client.close();
    process.exit(0);
  }
}

main().catch(console.error);
