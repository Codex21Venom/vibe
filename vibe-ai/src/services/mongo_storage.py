import os
import json
import asyncio
from typing import Optional, Any
from datetime import datetime, timezone
from bson.objectid import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
import pymongo

class MongoStorageService:
    """MongoDB GridFS storage service with TTL support"""
    
    def __init__(self):
        # Use existing MongoDB URI or fallback to localhost
        self.mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/vibe')
        self.db_name = os.getenv('MONGO_DB_NAME', 'vibe')
        
        # Instantiate a new Motor client per instance (required since tasks run in different threads/event loops)
        self.client = AsyncIOMotorClient(self.mongo_uri)
            
        self.db = self.client[self.db_name]
        self.fs = AsyncIOMotorGridFSBucket(self.db)
        self.server_url = os.getenv('VIBE_AI_SERVER_URL', 'http://localhost:8017')
        
        # Start initialization (create TTL indexes)
        asyncio.create_task(self._init_indexes())

    async def _init_indexes(self):
        """Create TTL indexes on fs.files and fs.chunks to automatically delete expired files."""
        try:
            # 86400 seconds = 24 hours
            ttl_seconds = int(os.getenv('TEMP_FILES_TTL_SECONDS', 86400))
            
            await self.db.fs.files.create_index(
                [("createdAt", pymongo.ASCENDING)],
                expireAfterSeconds=ttl_seconds
            )
            await self.db.fs.chunks.create_index(
                [("createdAt", pymongo.ASCENDING)],
                expireAfterSeconds=ttl_seconds
            )
            print(f"MongoDB GridFS TTL indexes initialized ({ttl_seconds}s)")
        except Exception as e:
            print(f"Error initializing MongoDB GridFS indexes: {e}")

    async def upload_file(self, file_path: str, destination_name: str, content_type: str = 'application/octet-stream') -> Optional[str]:
        """
        Upload a file to MongoDB GridFS with TTL.
        """
        print(f"MongoStorage upload_file called: file_path={file_path}, destination_name={destination_name}")
        
        if not os.path.exists(file_path):
            print(f"File does not exist: {file_path}")
            return None
            
        try:
            with open(file_path, 'rb') as file_data:
                file_id = await self.fs.upload_from_stream(
                    destination_name,
                    file_data,
                    metadata={"contentType": content_type}
                )
            
            # Add createdAt field for TTL index
            current_time = datetime.now(timezone.utc)
            await self.db.fs.files.update_one(
                {"_id": file_id},
                {"$set": {"createdAt": current_time}}
            )
            
            # Update all chunks to also have createdAt for TTL index
            await self.db.fs.chunks.update_many(
                {"files_id": file_id},
                {"$set": {"createdAt": current_time}}
            )
            
            print(f"File uploaded successfully to MongoDB GridFS. File ID: {file_id}")
            
            # Return the endpoint URL to access the file
            public_url = f"{self.server_url}/jobs/temp_files/{str(file_id)}"
            print(f"Public URL generated: {public_url}")
            return public_url
            
        except Exception as e:
            print(f"Error uploading file to MongoDB: {str(e)}")
            return None

    async def upload_text_content(self, content: str, destination_name: str, content_type: str = 'text/plain') -> Optional[str]:
        """
        Upload text content directly to MongoDB GridFS.
        """
        try:
            # Convert text to bytes
            content_bytes = content.encode('utf-8')
            
            file_id = await self.fs.upload_from_stream(
                destination_name,
                content_bytes,
                metadata={"contentType": content_type}
            )
            
            current_time = datetime.now(timezone.utc)
            await self.db.fs.files.update_one(
                {"_id": file_id},
                {"$set": {"createdAt": current_time}}
            )
            await self.db.fs.chunks.update_many(
                {"files_id": file_id},
                {"$set": {"createdAt": current_time}}
            )
            
            public_url = f"{self.server_url}/jobs/temp_files/{str(file_id)}"
            return public_url
            
        except Exception as e:
            print(f"Error uploading text content to MongoDB: {str(e)}")
            return None

    async def upload_json_content(self, data: Any, destination_name: str) -> Optional[str]:
        """
        Upload JSON data to MongoDB GridFS.
        """
        json_content = json.dumps(data)
        return await self.upload_text_content(json_content, destination_name, 'application/json')
