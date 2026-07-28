import "dotenv/config";
import { MongoClient } from "mongodb";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function verify() {
  const uri = process.env.DB_URL || process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || "vibe";

  console.log(`📡 Connecting to MongoDB Atlas: ${uri}...`);
  const client = new MongoClient(uri!);

  try {
    await client.connect();
    const db = client.db(dbName);
    
    // 1. Check database ping
    const pingResult = await db.command({ ping: 1 });
    console.log("✅ MongoDB Atlas Ping Result:", pingResult);

    // 2. Query collections in 'vibe' database
    const collections = await db.listCollections().toArray();
    console.log("✅ Existing Collections in 'vibe' database:", collections.map(c => c.name));

    // 3. Count documents in users collection
    const usersCount = await db.collection("users").countDocuments();
    console.log(`✅ Total User Records in Atlas 'users' collection: ${usersCount}`);

    // 4. Test API response from backend server (http://localhost:4001/api/courses/public)
    try {
      const response = await fetch("http://localhost:4001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@vibe.com",
          password: "admin123",
          recaptchaToken: "NO_CAPTCHA"
        })
      });
      const loginData: any = await response.json();
      console.log("✅ Backend API Login Test against Atlas DB:", response.status, loginData.email ? `User authenticated: ${loginData.email}` : loginData);
    } catch (apiErr) {
      console.log("Backend API call notice:", apiErr);
    }

  } catch (err) {
    console.error("❌ Error connecting to MongoDB Atlas:", err);
  } finally {
    await client.close();
    process.exit(0);
  }
}

verify().catch(console.error);
