# Telegram-bot

基于 TypeScript + Node.js 开发的 Telegram 机器人框架，适用于中大型 Telegram 机器人开发。
支持群组管理、用户积分系统、排行榜、抽奖活动等功能。

## 🌟 特性

- 基于 TypeScript，提供完整的类型支持
- 模块化设计，易于扩展
- 支持多种命令处理
- MongoDB 数据持久化
- 完整的用户积分系统
- 排行榜分页显示
- 定时任务调度
- 抽奖活动系统

## 📁 项目结构

```
src/
|-- bot/
| |-- TelegramBot.ts        // Telegram Bot 核心类，处理机器人初始化和基础功能
| |-- CommandController.ts   // 命令控制器，管理和分发各类命令
|
|-- commands/               // 命令模块目录
| |-- LotteryCommand.ts    // 抽奖活动相关命令
| |-- MessageCommand.ts    // 消息处理命令
| |-- RankingCommand.ts    // 排行榜相关命令
| |-- TwitterCommand.ts    // Twitter 任务相关命令
| |-- UserCommand.ts       // 用户管理相关命令
|
|-- models/                // 数据模型目录
| |-- DatabaseModels.ts    // MongoDB 数据模型定义
| |-- TelegramTypes.ts     // Telegram 相关类型定义
|
|-- scheduler/             // 定时任务调度目录
| |-- LotteryScheduler.ts  // 抽奖活动调度器
| |-- TwitterScheduler.ts  // Twitter 任务调度器
|
|-- services/             // 服务层目录
| |-- MongodbApiService.ts // MongoDB 数据库服务
| |-- PageinationService.ts // 分页服务
|
|-- index.ts              // 应用程序入口文件
```

## 🚀 使用方法

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
在项目根目录创建 `.env` 文件，添加以下配置：
```env
BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=your_mongodb_connection_string
```

3. 编译 TypeScript
```bash
npm run build
```

4. 运行机器人
```bash
npm start
```

## 📚 主要功能

### 1. 用户管理
- 用户注册和信息管理
- 用户积分系统
- 用户权限控制

### 2. 排行榜系统
- 总积分排行
- 活跃度排行
- 邀请排行
- Twitter 任务排行
- 支持分页显示（每页20条）

### 3. 抽奖活动
- 创建和管理抽奖活动
- 自动开奖
- 中奖记录查询

### 4. Twitter 任务
- Twitter 任务发布
- 任务完成验证
- 奖励发放

## 🛠 开发说明

1. 添加新命令
- 在 `commands` 目录下创建新的命令类
- 在 `CommandController.ts` 中注册新命令

2. 添加新功能
- 遵循模块化设计
- 在相应目录创建新的功能模块
- 更新相关服务和控制器

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request
