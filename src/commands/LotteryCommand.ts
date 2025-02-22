import { User } from "../models/DatabaseModels";
import { CustomContext } from "../models/TelegramTypes";
import LotteryScheduler from "../scheduler/LotteryScheduler";
import { MongodbService } from "../services/MongodbApiService";

export class LotteryCommand {
  //private getLotteryScheduler!: (chatId: number) => LotteryScheduler | undefined;
  private static getLotteryScheduler: LotteryScheduler;

// 处理抽奖参与
static async handleLotteryParticipation(ctx: CustomContext, userId: number, userData: Partial<User>) {
    const { first_name: firstName, last_name: lastName } = ctx.from || {};
    const username = userData.username || `${firstName}${lastName}`;
    const chatId = ctx.chat?.id;
  
    if (!chatId) return;
  
    // const lotteryScheduler = this.getLotteryScheduler();
    // if (!lotteryScheduler) return;
  
    const lottery = await LotteryScheduler.getLottery(chatId);
    if (!lottery) return;
  
    console.log('lotteryScheduler: find:', lottery.lotteryId);
    // 检查用户是否已经在参与者列表中
    const participantExists = lottery.participants.some(participant => participant.userId === userId);
    if (participantExists) {
      console.log(`User ${username} (ID: ${userId}) is already in the participant list.`);
      return;
    }
    LotteryScheduler.addParticipant(userId, username, lottery);
  
    const startDate = new Date(new Date().setHours(0, 0, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const drawDate = new Date(new Date().setHours(23, 30, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const participantCount = lottery.participants.length;
  
    // 更新提醒标志
    userData.notifiedForLottery = true;
    await MongodbService.updateUser({ uid: userId, notifiedForLottery: true });
  
    const lotteryInfo = `\n条件: 发言10条以上\n已参与：${participantCount} 人\n奖品：${lottery.prize} 分\n起始：${startDate}\n开奖：${drawDate}`;
    await ctx.reply(`🎉 恭喜 @${userData.username} 参与成功！\n\n🎁 群活跃抽奖(${this.getCurrentDate()})${lotteryInfo}`);
  }


  //更新中奖积分（统计发言）
  static async updateLottery(winners: number[]): Promise<void> {
    try {
      // 遍历每个获奖用户的 ID
      for (const userId of winners) {
        const user = await MongodbService.getUser(userId);
        const score = 30;
        if (user) {
          const newScore = (user?.lotteryPoints || 0) + score;

          await MongodbService.updateUser({
            uid: userId,
            //twitters: newScore,
            lotteryPoints: newScore,
            //lastSubmited: new Date(),
          });
          console.log(`✅ 用户 ${user?.username}(${userId})  中奖积分 ${score} 分已派发！`);
        }
        else {
          console.log(`未找到用户 ID: ${userId}`);
        }
      }

    } catch (error) {
      console.error('更新抽奖结果时出错:', error);
    }
  }

  // 获取当前日期（格式：yyyy-mm-dd）
  private static getCurrentDate(): string {
    return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split('/').join('.');
  }

  // 显示当前抽奖信息
  static async showCurrentLottery(ctx: CustomContext) {
    if (!ctx.chat) {
      console.log('Error: Chat context is undefined');
      return;
    }

    const chatId = ctx.chat.id;
    const lottery = await LotteryScheduler.getLottery(chatId);
    if (!lottery) {
      await ctx.reply('当前没有进行中的抽奖');
      return;
    }

    const participantsCount = lottery.participants.length;
    const lotteryTitle = "群活跃抽奖("+lottery.createTime.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split("/").join(".")+")";

    const message = `🎁 当前抽奖信息：\n\n` +
      `🎁 活动名称：${lotteryTitle}\n` +
      `-奖品：${lottery.prize}\n` +
      `-参与人数：${participantsCount}\n` +
      `-参与条件：发言10条以上\n` +
      `-开始时间：${new Date(lottery.createTime).toLocaleString()}\n` +
      `-开奖时间：${new Date(lottery.endTime).toLocaleString()}\n\n` +
      `🎉满足条件即可自动参与抽奖！`;

    await ctx.reply(message);
  }
}