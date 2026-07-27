import { MongoClient, ObjectId } from 'mongodb';
import ytdl from '@distube/ytdl-core';
import { GoogleGenAI } from '@google/genai';
import zlib from 'zlib';
import dotenv from 'dotenv';
import fs from 'fs';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const MONGO_URI = process.env.DB_URL || 'mongodb://localhost:27017';
const DB_NAME = 'vibe';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Please set GEMINI_API_KEY in your .env file");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function processYoutubeVideo(youtubeUrl: string, itemId: string) {
  let client: MongoClient | null = null;
  try {
    console.log(`Connecting to MongoDB...`);
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const segmentContextCollection = db.collection('student_question_segment_context');

    console.log(`Downloading audio for: ${youtubeUrl}`);
    const info = await ytdl.getInfo(youtubeUrl);
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    
    // We'll pipe it to a buffer
    const audioStream = ytdl(youtubeUrl, { format: audioFormat });
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);
    console.log(`Audio downloaded. Size: ${audioBuffer.length} bytes`);

    // Upload to Gemini
    console.log(`Uploading to Gemini...`);
    // Note: the @google/genai SDK requires uploading the file using the File API
    // We write temporarily to disk because the SDK prefers file paths
    const tempPath = `./temp_audio_${itemId}.mp4`;
    fs.writeFileSync(tempPath, audioBuffer);
    
    const uploadResult = await ai.files.upload({
      file: tempPath,
      mimeType: audioFormat.mimeType?.split(';')[0] || 'audio/mp4',
    });
    
    console.log(`Uploaded file: ${uploadResult.name}. Generating transcript...`);
    
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: uploadResult.uri,
                mimeType: uploadResult.mimeType,
              }
            },
            {
              text: "Please generate a highly detailed and accurate transcript of this audio. Format it as a JSON array of objects, where each object has a 'text' field (the spoken words), a 'start' field (start time in seconds), and an 'end' field (end time in seconds)."
            }
          ]
        }
      ]
    });
    
    const transcriptText = response.text || "[]";
    let transcriptJson;
    try {
      // Basic JSON extraction if wrapped in markdown code blocks
      const cleanedText = transcriptText.replace(/```json/g, '').replace(/```/g, '').trim();
      transcriptJson = JSON.parse(cleanedText);
    } catch (e) {
      console.log("Failed to parse AI response as JSON. Saving raw text instead.", e);
      transcriptJson = { raw: transcriptText };
    }
    
    console.log(`Compressing transcript...`);
    const compressedData = zlib.deflateSync(JSON.stringify(transcriptJson)).toString('base64');
    
    console.log(`Inserting into SegmentContextCollection for itemId: ${itemId}`);
    await segmentContextCollection.updateOne(
      { segmentId: itemId },
      {
        $set: {
          text: compressedData,
          source: 'TRANSCRIPT',
          updatedAt: new Date(),
        }
      },
      { upsert: true }
    );
    
    console.log(`Successfully completed!`);
    
    // Cleanup temp files
    fs.unlinkSync(tempPath);
    await ai.files.delete({ name: uploadResult.name });

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// CLI Argument parsing
const url = process.argv[2];
const id = process.argv[3];

if (!url || !id) {
  console.log("Usage: npx ts-node scripts/process-youtube-transcript.ts <YOUTUBE_URL> <ITEM_ID>");
  process.exit(1);
}

processYoutubeVideo(url, id);
