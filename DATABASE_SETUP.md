# Database Setup Guide

## Option 1: PostgreSQL (Recommended)

### Local Development Setup

#### Install PostgreSQL
```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Create database
createdb agriculture_ai_db

# Connect to database
psql agriculture_ai_db
```

#### Create Tables
```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  openid VARCHAR(255) UNIQUE NOT NULL,
  nickname VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Land blocks table
CREATE TABLE land_blocks (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fertilizers table
CREATE TABLE fertilizers (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2),
  unit VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fruit information table
CREATE TABLE fruit_information (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  land_block_id VARCHAR(255) REFERENCES land_blocks(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  img_url TEXT,
  fertilizer_ids JSON DEFAULT '[]'::json,
  content TEXT,
  extracted_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Images table
CREATE TABLE images (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_land_blocks_user_id ON land_blocks(user_id);
CREATE INDEX idx_fruit_info_land_block ON fruit_information(land_block_id);
CREATE INDEX idx_fruit_info_created_at ON fruit_information(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_land_blocks_updated_at BEFORE UPDATE ON land_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fertilizers_updated_at BEFORE UPDATE ON fertilizers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fruit_info_updated_at BEFORE UPDATE ON fruit_information FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Option 2: MySQL Setup

#### Install MySQL
```bash
# macOS
brew install mysql
brew services start mysql

# Connect and create database
mysql -u root -p
CREATE DATABASE agriculture_ai_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agriculture_ai_db;
```

#### Create Tables (MySQL)
```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  openid VARCHAR(255) UNIQUE NOT NULL,
  nickname VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Land blocks table
CREATE TABLE land_blocks (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Fertilizers table
CREATE TABLE fertilizers (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2),
  unit VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Fruit information table
CREATE TABLE fruit_information (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  land_block_id VARCHAR(255),
  session_id VARCHAR(255),
  img_url TEXT,
  fertilizer_ids JSON,
  content TEXT,
  extracted_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (land_block_id) REFERENCES land_blocks(id) ON DELETE CASCADE
);

-- Images table
CREATE TABLE images (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  url TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_land_blocks_user_id ON land_blocks(user_id);
CREATE INDEX idx_fruit_info_land_block ON fruit_information(land_block_id);
CREATE INDEX idx_fruit_info_created_at ON fruit_information(created_at);
```

## Option 3: Tencent Cloud Database

### TencentDB for PostgreSQL
1. Go to [Tencent Cloud Console](https://console.cloud.tencent.com/)
2. Navigate to **Database** > **TencentDB for PostgreSQL**
3. Click **Create Instance**
4. Configure:
   - **Region**: Choose closest to your users
   - **Version**: PostgreSQL 13+ recommended
   - **Instance Class**: Start with Basic/Standard
   - **Storage**: 20GB+ recommended
5. Set master username/password
6. Configure network (VPC recommended)
7. Create the instance

### TencentDB for MySQL
1. Go to **Database** > **TencentDB for MySQL**
2. Click **Create Instance**
3. Similar configuration as above
4. Choose MySQL 8.0+ for better JSON support

### Connection Configuration
After creating your cloud database:

```javascript
// For Node.js backend with PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  user: 'your_username',
  host: 'your_tencent_db_host',
  database: 'agriculture_ai_db',
  password: 'your_password',
  port: 5432,
  ssl: {
    require: true,
    rejectUnauthorized: false // For Tencent Cloud
  }
});

// For MySQL
const mysql = require('mysql2/promise');

const connection = mysql.createConnection({
  host: 'your_tencent_mysql_host',
  user: 'your_username',
  password: 'your_password',
  database: 'agriculture_ai_db',
  ssl: {
    rejectUnauthorized: false
  }
});
```

## Environment Variables

Create a `.env` file in your backend:

```bash
# Database Configuration
DB_TYPE=postgresql  # or mysql
DB_HOST=your_db_host
DB_PORT=5432       # 5432 for PostgreSQL, 3306 for MySQL
DB_NAME=agriculture_ai_db
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true        # true for cloud databases

# WeChat Configuration
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret

# JWT & Security
JWT_SECRET=your_jwt_secret_key

# AI Services
OPENAI_API_KEY=your_openai_key
# or
TENCENT_AI_SECRET_ID=your_tencent_ai_id
TENCENT_AI_SECRET_KEY=your_tencent_ai_key

# File Storage
UPLOAD_PATH=./uploads
# or for cloud storage
TENCENT_COS_BUCKET=your_cos_bucket
TENCENT_COS_REGION=your_region
```

## Quick Test

After setting up your database, test the connection:

```sql
-- Insert test data
INSERT INTO users (openid, nickname) VALUES ('test_openid_123', 'Test User');
INSERT INTO land_blocks (user_id, name, description) 
VALUES ((SELECT id FROM users WHERE openid = 'test_openid_123'), 'Test Field', 'A test agricultural field');

-- Query test
SELECT u.nickname, lb.name as land_block_name 
FROM users u 
JOIN land_blocks lb ON u.id = lb.user_id;
```

## Recommended: PostgreSQL with Tencent Cloud

For your project, I recommend:
1. **TencentDB for PostgreSQL** (since you're using Tencent Cloud)
2. Use the PostgreSQL SQL schema above
3. Set up proper indexes for performance
4. Enable SSL for security

Would you like me to help you set up a specific database option or create a backend API implementation?