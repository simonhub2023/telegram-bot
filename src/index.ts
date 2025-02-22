// src/index.ts
import 'dotenv/config'; // 加载环境变量
import config from "../config/config";
import { TelegramBot } from './bot/TelegramBot';
import { connectToDatabase } from './services/MongodbApiService';

// 启动函数
async function bootstrap() {
  try {
    // 1. 连接 MongoDB
    await connectToDatabase();
    console.log('✅ MongoDB 连接成功');

    // 2. 初始化机器人
    const BOT_TOKEN = config.telegramBotToken;
    //console.log('bot-token:',BOT_TOKEN);
    const bot = new TelegramBot(BOT_TOKEN!);

    bot.start();
    
    // 3. 捕获关闭信号
    process.once('SIGINT', () => {
      console.log('\n🚫 收到终止信号，关闭机器人');
      //bot.stop();
      process.exit();
    });

  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

// 启动应用
bootstrap();