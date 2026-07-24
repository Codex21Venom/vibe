import "dotenv/config";
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import dns from "dns";

const MONGO_URI = process.env.DB_URL || process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "vibe";

async function main() {
  if (!MONGO_URI) {
    console.error("Error: DB_URL or MONGO_URI environment variable is missing.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npm run seed:user <email> <password> [firstName] [lastName]");
    process.exit(1);
  }

  const email = args[0];
  const password = args[1];
  const firstName = args[2] || email.split("@")[0].replace(/[^A-Za-z]/g, "");
  const lastName = args[3] || "";

  console.log(`Setting DNS servers to avoid querySrv ECONNREFUSED...`);
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  console.log(`Connecting to MongoDB...`);
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCollection = db.collection("users");

    console.log(`Hashing password for ${email}...`);
    const hashedPassword = await bcrypt.hash(password, 10);

    const userPayload = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      roles: "user",
      authProvider: "local",
      updatedAt: new Date(),
    };

    console.log(`Upserting user into 'users' collection...`);
    const result = await usersCollection.updateOne(
      { email },
      { 
        $set: userPayload,
        $setOnInsert: {
          createdAt: new Date(),
          firebaseUID: `local_${Date.now()}` // fallback, auth sets this to object _id later
        }
      },
      { upsert: true }
    );

    if (result.upsertedId) {
      console.log(`Success! Created new user with ID: ${result.upsertedId}`);
    } else {
      console.log(`Success! Updated existing user with email: ${email}`);
    }
  } catch (error) {
    console.error("Error seeding user:", error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

main().catch(console.error);
