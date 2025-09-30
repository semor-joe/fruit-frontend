# Backend API Documentation

This miniprogram requires a backend server to handle user authentication, data storage, and AI analysis. Below are the required API endpoints that need to be implemented.

## Base URL
Update the `baseUrl` in `/miniprogram/utils/database.ts` to point to your backend server.

## Authentication

### POST /api/auth/login
Login with WeChat code and get access token.

**Request:**
```json
{
  "code": "string" // WeChat login code
}
```

**Response:**
```json
{
  "token": "string",
  "user": {
    "id": "string",
    "openid": "string",
    "nickname": "string",
    "avatar_url": "string",
    "created_at": "ISO_DATE",
    "updated_at": "ISO_DATE"
  }
}
```

## User Management

### GET /api/users/:id
Get user information by ID.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "string",
  "openid": "string", 
  "nickname": "string",
  "avatar_url": "string",
  "created_at": "ISO_DATE",
  "updated_at": "ISO_DATE"
}
```

### PUT /api/users/:id
Update user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "nickname": "string",
  "avatar_url": "string"
}
```

**Response:**
```json
{
  "id": "string",
  "openid": "string", 
  "nickname": "string",
  "avatar_url": "string",
  "created_at": "ISO_DATE",
  "updated_at": "ISO_DATE"
}
```

## Land Blocks

### POST /api/land-blocks
Create a new land block.

**Request:**
```json
{
  "user_id": "string",
  "name": "string",
  "description": "string"
}
```

### GET /api/land-blocks?user_id=:userId
Get all land blocks for a user.

### PUT /api/land-blocks/:id
Update a land block.

### DELETE /api/land-blocks/:id
Delete a land block.

## Fruit Information

### POST /api/fruit-information
Create new fruit information record.

**Request:**
```json
{
  "land_block_id": "string",
  "session_id": "string",
  "img_url": "string",
  "fertilizer_ids": ["string"],
  "content": "string",
  "extracted_data": "object"
}
```

### GET /api/fruit-information?user_id=:userId&limit=:limit&offset=:offset
Get fruit information records with pagination.

### PUT /api/fruit-information/:id
Update fruit information record.

### DELETE /api/fruit-information/:id
Delete fruit information record.

## Fertilizers

### POST /api/fertilizers
Create a new fertilizer record.

**Request:**
```json
{
  "name": "string",
  "amount": "number",
  "unit": "string", 
  "description": "string"
}
```

### GET /api/fertilizers
Get all fertilizers.

### PUT /api/fertilizers/:id
Update fertilizer record.

## Image Management

### POST /api/images/upload
Upload image file.

**Request:**
Form data with image file.

**Response:**
```json
{
  "id": "string",
  "url": "string",
  "file_path": "string",
  "created_at": "ISO_DATE"
}
```

### POST /api/images/:id/analyze
Analyze uploaded image with AI.

**Response:**
```json
{
  "id": "string",
  "url": "string",
  "content": "string", // JSON string with analysis results
  "created_at": "ISO_DATE"
}
```

## AI Analysis

### POST /api/ai/analyze-text
Analyze text input with AI to extract agricultural information.

**Request:**
```json
{
  "text": "string",
  "land_block_id": "string"
}
```

**Response:**
```json
{
  "fertilizers": [
    {
      "name": "string",
      "amount": "string",
      "unit": "string"
    }
  ],
  "crops": "string",
  "conditions": "string", 
  "suggestions": "string"
}
```

## Statistics

### GET /api/statistics?user_id=:userId&start=:start&end=:end
Get user statistics for a date range.

**Response:**
```json
{
  "totalRecords": "number",
  "totalLandBlocks": "number", 
  "totalImages": "number",
  "totalFertilizers": "number",
  "landBlocks": [
    {
      "id": "string",
      "name": "string",
      "recordCount": "number"
    }
  ],
  "fertilizers": [
    {
      "name": "string",
      "totalAmount": "number",
      "unit": "string"
    }
  ],
  "recentActivity": [
    {
      "id": "string",
      "title": "string",
      "description": "string", 
      "createdAt": "ISO_DATE"
    }
  ]
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  openid VARCHAR(255) UNIQUE NOT NULL,
  nickname VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Land Blocks Table
```sql
CREATE TABLE land_blocks (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Fruit Information Table
```sql
CREATE TABLE fruit_information (
  id VARCHAR(255) PRIMARY KEY,
  land_block_id VARCHAR(255) REFERENCES land_blocks(id),
  session_id VARCHAR(255),
  img_url TEXT,
  fertilizer_ids JSON,
  content TEXT,
  extracted_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Fertilizers Table
```sql
CREATE TABLE fertilizers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2),
  unit VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Images Table
```sql
CREATE TABLE images (
  id VARCHAR(255) PRIMARY KEY,
  url TEXT NOT NULL,
  content TEXT, -- AI analysis result
  file_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## AI Integration

For the AI analysis features, you'll need to integrate with AI services like:
- OpenAI GPT for text analysis
- Computer Vision APIs for image recognition
- Custom trained models for agricultural data extraction

The AI should be able to:
1. Extract fertilizer information from text descriptions
2. Identify crops and their conditions from images
3. Provide agricultural recommendations
4. Detect environmental conditions

## Environment Variables

Make sure to set these environment variables in your backend:

```
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
DATABASE_URL=your_database_connection_string
AI_API_KEY=your_ai_service_api_key
JWT_SECRET=your_jwt_secret
UPLOAD_PATH=path_to_store_uploaded_files
```