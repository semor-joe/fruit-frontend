# 智能农业识别系统 - WeChat Miniprogram

这是一个基于微信小程序的智能农业管理系统，使用AI技术自动识别和提取农业信息。

## 功能特性

### 🔐 用户系统
- 微信授权登录
- 个人数据隔离
- 用户状态管理

### 📊 数据管理
- **用户表**: 存储用户基本信息
- **地块表**: 管理不同的农业地块
- **果实信息表**: 记录农作物相关数据
- **肥料表**: 管理肥料使用信息
- **图片表**: 存储和分析上传的图片

### 🤖 AI智能识别
- 文本信息智能提取
- 图片内容自动识别
- 肥料信息自动解析
- 农业建议生成

### 📱 核心页面

#### 1. 添加内容页面
- 地块选择和管理
- 文本输入（支持2000字符）
- 多图片上传（最多9张）
- AI实时分析
- 结果预览和保存

#### 2. 查看内容页面
- 历史记录浏览
- 搜索和筛选功能
- 内容编辑和删除
- AI分析结果展示

#### 3. 统计分析页面
- 数据统计概览
- 地块使用分析
- 肥料使用统计
- 最近活动时间线
- AI洞察建议
- 数据导出功能

## 项目结构

```
miniprogram/
├── app.json                 # 小程序配置
├── app.ts                   # 应用入口
├── app.wxss                 # 全局样式
├── pages/
│   ├── login/              # 登录页面
│   ├── add-content/        # 添加内容页面
│   ├── check-content/      # 查看内容页面
│   ├── statistics/         # 统计页面
│   └── index/              # 首页（重定向）
├── utils/
│   ├── database.ts         # 数据库接口
│   └── util.ts            # 工具函数
└── images/                 # 静态图片资源
```

## 开发环境搭建

### 前端（小程序）
1. 安装微信开发者工具
2. 导入项目目录
3. 配置 AppID
4. 修改 `utils/database.ts` 中的 `baseUrl` 为你的后端地址

### 后端
参考 `BACKEND_API.md` 文档搭建后端服务，需要实现：
- 用户认证系统
- 数据库操作接口
- AI分析服务
- 文件上传功能

## 技术栈

- **前端**: 微信小程序原生开发 + TypeScript
- **后端**: Node.js/Python/Java（任选）
- **数据库**: MySQL/PostgreSQL
- **AI服务**: OpenAI GPT / 自定义模型
- **存储**: 云存储服务

## 核心功能流程

### 1. 用户登录流程
```
用户打开小程序 → 检查登录状态 → 微信授权 → 获取用户信息 → 存储登录状态
```

### 2. 内容添加流程  
```
选择地块 → 输入文本/上传图片 → AI分析 → 预览结果 → 确认保存
```

### 3. AI分析流程
```
用户输入 → 后端AI服务 → 信息提取 → 结构化数据 → 返回前端展示
```

## 部署说明

### 小程序发布
1. 在微信公众平台注册小程序
2. 配置服务器域名
3. 上传代码审核
4. 发布上线

### 后端部署
1. 部署后端服务到云服务器
2. 配置数据库连接
3. 集成AI服务接口
4. 配置文件存储服务
5. 设置环境变量

## 环境变量配置

创建 `.env` 文件：
```env
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
DATABASE_URL=your_database_url
AI_API_KEY=your_ai_api_key
JWT_SECRET=your_jwt_secret
```

## 开发注意事项

1. **安全性**
   - 所有API请求需要token验证
   - 用户数据严格隔离
   - 输入数据验证和清理

2. **性能优化**
   - 图片压缩上传
   - 分页加载数据
   - 缓存常用数据

3. **用户体验**
   - 加载状态提示
   - 错误处理和反馈
   - 离线数据缓存

## API接口文档

详细的API接口文档请参考 `BACKEND_API.md` 文件。

## 数据表设计

### 用户表 (users)
- id, openid, nickname, avatar_url, created_at, updated_at

### 地块表 (land_blocks)
- id, user_id, name, description, created_at, updated_at

### 果实信息表 (fruit_information)
- id, land_block_id, session_id, img_url, fertilizer_ids, content, extracted_data, created_at, updated_at

### 肥料表 (fertilizers)
- id, name, amount, unit, description, created_at, updated_at

### 图片表 (images)
- id, url, content, file_path, created_at

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或联系开发者。