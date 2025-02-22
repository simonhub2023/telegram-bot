import { User } from "../models/DatabaseModels";
import { CustomContext } from "../models/TelegramTypes";
import { MongodbService } from "../services/MongodbApiService";

export class UserCommand {  
  static async showMyScore(ctx: any) {
    const userId = ctx.from?.id;
    if (!userId) return; // 无法识别用户，直接忽略
    const user = await MongodbService.getUser(userId);
    if(!user) return;

    const points = user?.points || 0;
    const meetingPoints = user?.meetingPoints || 0;
    const invitePoints = user?.invitePoints || 0;
    const twitterPoints = user?.twitterPoints || 0;
    const donatePoints = user?.donatePoints || 0;
    const specialPoints = user?.specialPoints || 0;
    const lotteryPoints = user?.lotteryPoints || 0;

    const score = points + meetingPoints + invitePoints + twitterPoints + donatePoints + specialPoints + lotteryPoints;
    console.log("score:", score);
    ctx.reply(`
        🏆 ${user?.firstName}${user?.lastName || ""}, 总积分：${score}    
      --------------------    
      1. 群活跃积分:  ${points}
      2. 会议积分:  ${meetingPoints}
      3. 拉新积分:  ${invitePoints}
      4. 冲推积分:  ${twitterPoints}
      5. 中奖积分:  ${lotteryPoints}
      6. 捐赠积分:  ${donatePoints}
      7. 特殊贡献积分:  ${specialPoints} `);
  }


  static handleNewMember(ctx: CustomContext) {
    const newUserId = (ctx.message as any)?.new_chat_members?.[0]?.id;
    const startPayload = ctx.startPayload;
    if (!startPayload) return;

    const decodedPayload = Buffer.from(startPayload, 'base64').toString('utf-8');
    // const [chatId, inviterId] = decodedPayload.split('+').map(Number);

    const inviterId = parseInt(decodedPayload, 10);

    if (newUserId && inviterId) {
      try {
        MongodbService.recordInvite(inviterId, newUserId);
        ctx.reply(`🎉欢迎新成员！感谢 @${ctx.from?.username} 的邀请！\n
        🎁赢取SAT20高价值OG卡积分活动如下 👉 ：
        1、群活跃：签到+1分，发言1次+1分(每日50积分）；
        2、拉新：1人=15分（申请,发送/link||邀请链接）；
        3、会议：1次=10分，发言=20分，嘉宾/主持30分；       
        4、冲推：中文1条+3分，英文1条+5分，深度推文+10分；
        5、捐赠：向社区捐赠金额 1u ，+5分，无上限；
        6、抽奖：参与每天的抽奖活动10-100分（阅读抽奖条件）；
        7、参与社区其他活动；
          `);
      } catch (error) {
        console.error('Error recording invite:', error);
      }
    }
  }


  static updateUserData(userId: number, userData:  Partial<User>) {
    //console.log("updateUserData userId:", userId);
    MongodbService.updateUser({
        uid: userId,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        username: userData.username || '',
        dailyPoints: userData.dailyPoints,
        messagesSent: userData.messagesSent,
        points: userData.points,
        lastUpdated: new Date(),
        notifiedForLottery: userData.notifiedForLottery,
      });
    //throw new Error('Method not implemented.');
  }

  // 更新用户信息
  static async updateUserInfo(userId: number, firstName: string | undefined, lastName: string | undefined, username: string | undefined) {
    //console.log("updateUserInfo userId:", userId, "firstName:", firstName, "lastName:", lastName, "username:", username);
    return await MongodbService.updateUser({
        uid: userId,
        firstName: firstName || '',
        lastName: lastName || '',
        username: username || '',
      });
    //throw new Error('Method not implemented.');
  }

  
  // 检查并重置每日积分
  static resetDailyPointsIfNeeded(userData:  Partial<User>, today: string) {
    if(!userData.lastUpdated) return;
    const lastUpdated = new Date(userData.lastUpdated).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split('/').join('-');
    if (lastUpdated !== today) {
      userData.dailyPoints = 0;
      userData.notifiedForLottery = false;
    }
    return userData;
  }
  

  // 处理目标群的消息
  static async handleTargetChatMessage(userData: Partial<User>, messageText: string) {
    // 确保必要的属性存在
    //console.log("handleTargetChatMessage userData:", userData);
    console.log("Checking messagesSent:", userData.messagesSent, "Type:", typeof userData.messagesSent);

    if (userData.messagesSent === undefined || userData.messagesSent < 0) {
        console.log("handleTargetChatMessage return:", userData); 
        return;
    } 
    if (userData.points === undefined) userData.points = 0; // 初始化 points
    if (userData.dailyPoints === undefined) userData.dailyPoints = 0; // 初始化 points

    userData.messagesSent += 1;

    // 简化条件判断
    const canAddPoints = userData.dailyPoints !== undefined && userData.dailyPoints < 50 && messageText.length >= 4;
    //console.log("canAddPoints:", canAddPoints);
    if (canAddPoints) {
      userData.points += 1;
      userData.dailyPoints += 1;
      console.log(`用户 ${userData.username || '未知用户'} 增加了1积分, 当日积分：${userData.dailyPoints}`);
    } else if (userData.dailyPoints !== undefined && userData.dailyPoints >= 50) {
      console.log(`用户 ${userData.username || '未知用户'} 当日发言已达积分上限: ${userData.dailyPoints}`);
    }

    if (!userData.uid) return;

    // console.log("***handleTargetChatMessage uid:", userData.uid, "messagesSent:", userData.messagesSent, "points:", userData.points, "dailyPoints:", userData.dailyPoints, "messageText.length:", messageText.length);

    // 更新用户数据并处理可能的错误
    try {
      this.updateUserData(userData.uid, userData);
    } catch (error) {
      console.error('更新用户数据失败:', error);
    }
  }


  // 生成邀请链接
  static async generateInviteLink(ctx: CustomContext, bot: any) {
     
    const userId = ctx.from?.id;
    //const chatId = ctx.chat?.id;
    const botName = bot.botInfo?.username;    
    if (!userId || !botName) return;
    console.log("generateInviteLink userId:", userId, "botName:", botName);
    try {
      const inviteLink = await MongodbService.generateInviteLink(userId, botName);
      console.log("inviteLink:", inviteLink);
      ctx.reply(`你的邀请链接已生成：${inviteLink}`);
      //return inviteLink;
    } catch (error) {
      console.error('Error generating invite link:', error);
      ctx.reply('生成邀请链接时出错，请稍后再试。');
    }    
  }

}