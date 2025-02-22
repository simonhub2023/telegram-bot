import schedule from 'node-schedule';
import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import { MongodbService } from '../services/MongodbApiService';
import { ILottery } from '../models/DatabaseModels';

class LotteryScheduler {
   
  private bot: Telegraf;
  private dbService: MongodbService;
  private static currentLotteryId: string | null = null;
  private chatId: number;

  constructor(bot: Telegraf, dbService: MongodbService, chatId: number) {
    this.bot = bot;
    this.dbService = dbService;
    this.chatId = chatId;
  }

  public async start() {
    // 检查并处理未完成的任务
    await this.checkAndProcessPendingTasks();

    // Schedule daily lottery creation at 00:00 (Asia/Shanghai time)
    schedule.scheduleJob({ tz: 'Asia/Shanghai', rule: '0 0 * * *' }, async () => {
      const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      console.log(`Creating today's lottery at ${now}`);
      await this.createLottery();
    });

    // Schedule daily lottery draw at 23:30 (Asia/Shanghai time)
    schedule.scheduleJob({ tz: 'Asia/Shanghai', rule: '30 23 * * *' }, async () => {
      const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      console.log(`Drawing lottery winners at ${now}`);
      const defaultLotteryNum = 2; // 2 winners
      const defaultLotteryRate = 0.5; // 50% of participants will win
      await this.drawLottery(defaultLotteryNum, defaultLotteryRate);
    });
  }

  private async checkAndProcessPendingTasks() {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const pendingLotteries = await this.dbService.getPendingLotteries(this.chatId, now);

    for (const lottery of pendingLotteries) {
      LotteryScheduler.currentLotteryId = lottery.lotteryId.toString();

      // 如果抽奖活动已经创建但未开奖，则进行开奖
      if (!lottery.isDrawn) {
        console.log(`Found pending lottery draw for ID: ${LotteryScheduler.currentLotteryId}. Drawing now...`);
        const defaultLotteryNum = 2; // 2 winners
        const defaultLotteryRate = 0.5; // 50% of participants will win
        await this.drawLottery(defaultLotteryNum, defaultLotteryRate);
      }
    }

    if (pendingLotteries.length === 0) {
      // 如果当天没有创建抽奖活动，则创建一个新的抽奖活动
      console.log('No lottery found for today. Creating new lottery...');
      await this.createLottery();
    }
  }

  public async createLottery() {
    const endTime = new Date(new Date().setHours(23, 30, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const endTimeUTC = new Date(endTime).toISOString();

    // 检查当天是否已经存在未结束的抽奖活动
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const existingLottery = await MongodbService.getLatestLottery(this.chatId, todayStart);
    if (existingLottery) {
      console.log('Lottery already exists for today.');
      return;
    }

    // 创建新的抽奖活动
    const newLottery: ILottery = {
      lotteryId: new mongoose.Types.ObjectId().toString(), // 生成唯一的 lotteryId
      prize: "30",
      chatId: this.chatId,
      createTime: new Date(),
      endTime: new Date(endTimeUTC), // 设置结束时间为当天的23:30
      participants: [],
      winners: [],
      isDrawn: false, // 添加这个字段      
    };
    const createdLottery = await this.dbService.createLottery(newLottery);
    LotteryScheduler.currentLotteryId = createdLottery.lotteryId.toString();
    console.log(`Lottery created with ID: ${LotteryScheduler.currentLotteryId}`);
  }

  public async drawLottery(defaultLotteryNum: number, defaultLotteryRate: number) {
    if (!LotteryScheduler.currentLotteryId) {
      console.log('No lottery found for today.');
      return;
    }

    console.log('Drawing lottery winners...currentLotteryId:', LotteryScheduler.currentLotteryId);
    const lottery = await MongodbService.getLottery(LotteryScheduler.currentLotteryId);
    if (!lottery) {
      console.log('drawLottery: Lottery data not found.');
      return;
    }

    if (lottery.isDrawn) {
      console.log('Lottery has already been drawn.');
      return;
    }

    const activeUsers = lottery.participants.filter(
      (participant: { messageCount: number; }) => participant.messageCount && participant.messageCount >= 10
    );

    if (activeUsers.length < defaultLotteryNum) {
      console.log('No eligible participants for today\'s lottery.');

      //作废本次抽奖活动 Update lottery with isDrawn set to true
      await this.dbService.updateLottery(LotteryScheduler.currentLotteryId, { isDrawn: true });

      //清除符合抽奖条件的用户，并重置用户的 notifiedForLottery
      await this.resetParticipants();

      await this.bot.telegram.sendMessage(lottery.lotteryId, `Sorry,本次开奖失败！--开奖条件最低${defaultLotteryNum}人。`, {
        parse_mode: 'HTML',
      });      
      return;
    }

    const winnerCount = Math.floor(activeUsers.length * defaultLotteryRate);
    const winners = this.selectWinners(activeUsers, winnerCount);
    const winnerIds = winners.map((winner) => winner.userId);

    // Update lottery with winners and set isDrawn to true
    await this.dbService.updateLotteryWinners(LotteryScheduler.currentLotteryId, winnerIds);
    await this.dbService.updateLottery(LotteryScheduler.currentLotteryId, { isDrawn: true });
   

    const lotteryTitle = "群活跃抽奖("+lottery.createTime.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split("/").join(".")+")";
    

    // 获取每个中奖用户的用户名或昵称
    const winnerMentions = await Promise.all(
      winners.map(async (winner) => {        
        const user = await this.bot.telegram.getChatMember(lottery.chatId, winner.userId);
        const userName = (user.user.first_name ?? '') + ' ' + (user.user.last_name ?? '');
        return `🎉<a href="tg://user?id=${winner.userId}">${userName}</a> +30积分`;
      })
    );

    const announceMessage =` ${lotteryTitle}
🎁 活动开奖啦！\n
参与: ${activeUsers.length} 人; 中奖:${winners.length} 人

🥳🥳恭喜以下中奖用户:`


    // Announce winners and award points
    const message = `${announceMessage}\n${winnerMentions.join('\n')}\n\n中奖励积分已自动发放。`;

    await this.bot.telegram.sendMessage(lottery.chatId, message, {
      parse_mode: 'HTML',
    });

    // Award points to winners
    for (const winner of winners) {
      let user = await MongodbService.getUser(winner.userId);
      if (!user) {
        console.log(`Award points to winners not found: ${winner.userId}`);
        continue;
      }
      await this.dbService.addLotteryPointsToUser(user, 30);
    }

    // 清除符合抽奖条件的用户，并重置用户的 notifiedForLottery
    await this.resetParticipants();
  }
 

  public static async addParticipant(userId: number, username: string, lottery: ILottery) {
    //const lottery = await this.getLatestLottery(chatId);
    if (!lottery) {
      console.log('addParticipant: Lottery data not found.');
      return;
    }

    lottery.participants.push({ userId, messageCount: 10 }); // 假设 messageCount 为 10
    await MongodbService.updateLotteryParticipants(lottery.lotteryId.toString(), lottery.participants);
    console.log(`User ${username} (ID: ${userId}) added to the lottery.`);
  }

  

  public async getLotteryInfo(chatId: number): Promise<string> {
    //console.log('Getting lottery info...', chatId);
    const lottery = await LotteryScheduler.getLatestLottery(chatId);
    if (!lottery) {
      return 'No lottery found for today.';
    }

    const startDate = new Date(new Date().setHours(0, 0, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const drawDate = new Date(new Date().setHours(23, 30, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const participantCount = lottery.participants.length;
    return `\n条件: 发言10条以上\n已参与：${participantCount} 人\n奖品：${lottery.prize} 分\n起始：${startDate}\n开奖：${drawDate}`;
  }

  public static async getLottery(chatId: number): Promise<ILottery | null> {
    console.log('Getting lottery info...', chatId);
    return  await this.getLatestLottery(chatId);    
  }

  private static async getLatestLottery(chatId: number): Promise<ILottery | null> {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const lottery = await MongodbService.getLatestLottery(chatId, todayStart);
    
    if (lottery) {
      LotteryScheduler.currentLotteryId = lottery.lotteryId.toString();
    }
    return lottery;
  }

  private  async resetParticipants() {   
    const participants = await this.dbService.getAllParticipants();
    for (const participant of participants) {
      MongodbService.updateUser({ uid: participant.userId, notifiedForLottery: false });
      //console.log('participants been reset...', participant.userId);
    }   
  }

  private selectWinners(participants: { userId: number }[], count: number) {
    const winners = [];
    const participantPool = [...participants];

    while (winners.length < count && participantPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * participantPool.length);
      winners.push(participantPool[randomIndex]);
      participantPool.splice(randomIndex, 1);
    }

    return winners;
  }
}

export default LotteryScheduler;