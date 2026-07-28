import os
import json
import asyncio
from typing import Optional, Any
from datetime import datetime, timezone
from bson.objectid import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
import pymongo

class MongoStorageService:
    """MongoDB GridFS storage service with TTL and local fallback support"""
    
    def __init__(self):
        # Use DB_URL or MONGO_URI from environment, fallback to localhost
        self.mongo_uri = os.getenv('MONGO_URI') or os.getenv('DB_URL') or 'mongodb://localhost:27017/vibe'
        self.db_name = os.getenv('MONGO_DB_NAME') or os.getenv('DB_NAME') or 'vibe'
        
        # Instantiate a new Motor client per instance
        self.client = AsyncIOMotorClient(self.mongo_uri, serverSelectionTimeoutMS=3000)
            
        self.db = self.client[self.db_name]
        self.fs = AsyncIOMotorGridFSBucket(self.db)
        self.server_url = os.getenv('VIBE_AI_SERVER_URL', 'http://localhost:8017')
        
        # Start initialization (create TTL indexes)
        asyncio.create_task(self._init_indexes())

    async def _init_indexes(self):
        """Create TTL indexes on fs.files and fs.chunks to automatically delete expired files."""
        try:
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
            print(f"Notice: MongoDB GridFS TTL index init skipped (using local mode/fallback): {e}")

    async def upload_file(self, file_path: str, destination_name: str, content_type: str = 'application/octet-stream') -> Optional[str]:
        """
        Upload a file to MongoDB GridFS with TTL.
        Fallbacks to local temp storage if MongoDB is offline.
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
            
            current_time = datetime.now(timezone.utc)
            await self.db.fs.files.update_one(
                {"_id": file_id},
                {"$set": {"createdAt": current_time}}
            )
            await self.db.fs.chunks.update_many(
                {"files_id": file_id},
                {"$set": {"createdAt": current_time}}
            )
            
            print(f"File uploaded successfully to MongoDB GridFS. File ID: {file_id}")
            public_url = f"{self.server_url}/jobs/temp_files/{str(file_id)}"
            return public_url
            
        except Exception as e:
            print(f"MongoDB GridFS upload unavailable ({e}), using local file fallback...")
            try:
                temp_storage_dir = Path(__file__).parent.parent / "temp_storage"
                os.makedirs(temp_storage_dir, exist_ok=True)
                clean_name = destination_name.replace("/", "_")
                local_file_path = temp_storage_dir / clean_name
                import shutil
                shutil.copy2(file_path, local_file_path)
                public_url = f"{self.server_url}/jobs/temp_files/local_{clean_name}"
                print(f"Saved file to local storage fallback: {public_url}")
                return public_url
            except Exception as local_err:
                print(f"Error saving file to local storage fallback: {local_err}")
                return None

    async def upload_text_content(self, content: str, destination_name: str, content_type: str = 'text/plain', is_temporary: bool = True, compress: bool = False) -> Optional[str]:
        """
        Upload text content directly to MongoDB GridFS.
        Optionally compress it and set whether it is temporary (TTL).
        """
        try:
            content_bytes = content.encode('utf-8')
            
            if compress:
                import gzip
                original_size = len(content_bytes)
                content_bytes = gzip.compress(content_bytes)
                compressed_size = len(content_bytes)
                content_type = 'application/gzip'
                print(f"✅ Compression successful! Size reduced from {original_size} to {compressed_size} bytes.")
            
            file_id = await self.fs.upload_from_stream(
                destination_name,
                content_bytes,
                metadata={"contentType": content_type}
            )
            
            if is_temporary:
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
            print(f"MongoDB GridFS text upload unavailable ({e}), using local file fallback...")
            try:
                temp_storage_dir = Path(__file__).parent.parent / "temp_storage"
                os.makedirs(temp_storage_dir, exist_ok=True)
                clean_name = destination_name.replace("/", "_")
                local_file_path = temp_storage_dir / clean_name
                with open(local_file_path, 'wb') as f:
                    f.write(content_bytes)
                public_url = f"{self.server_url}/jobs/temp_files/local_{clean_name}"
                print(f"Saved text to local storage fallback: {public_url}")
                return public_url
            except Exception as local_err:
                print(f"Error saving text to local storage fallback: {local_err}")
                return None

    async def upload_json_content(self, data: Any, destination_name: str, is_temporary: bool = True, compress: bool = False) -> Optional[str]:
        """
        Upload JSON data to MongoDB GridFS.
        """
        json_content = json.dumps(data)
        return await self.upload_text_content(json_content, destination_name, 'application/json', is_temporary, compress)
