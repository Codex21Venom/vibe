import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const MONGO_URI = process.env.DB_URL || 'mongodb://localhost:27017';
const DB_NAME = 'vibe'; // Extracted from connection string or defaults to vibe

async function listVideos() {
  let client: MongoClient | null = null;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const videoCollection = db.collection('videos');

    const videos = await videoCollection.find({}).toArray();
    
    console.log(`\nFound ${videos.length} video(s):\n`);
    
    videos.forEach((v, index) => {
      console.log(`--- Video ${index + 1} ---`);
      console.log(`Name     : ${v.name}`);
      console.log(`ITEM_ID  : ${v._id}`);
      if (v.videoDetails && v.videoDetails.URL) {
        console.log(`YouTube  : ${v.videoDetails.URL}`);
      }
      console.log();
    });

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

listVideos();
