import { Context } from "telegraf";
import { CustomContext, ExtendedTextMessage } from "../models/TelegramTypes";
import { MongodbService } from "../services/MongodbApiService";

export class MessageCommand {
  //static db: MongodbService;
  static async handle(ctx: CustomContext) {
    const message = ctx.message as ExtendedTextMessage;
    const userId = ctx.from?.id;
    if (!userId) return;
    const userData = await MongodbService.getUser(userId);

    if (userData) {
      // 增加消息计数并检查积分
      if (userData.dailyPoints < 50 && message.text.length >= 4) {
        userData.points += 1;
        userData.dailyPoints += 1;
        console.log(`用户 ${userData.username} 增加了1积分, 当前每日积分：${userData.dailyPoints}`);
      } else {
        console.log(`用户 ${userData.username} 今日发言已达最大积分上限`, userData.dailyPoints);
      }

      // 更新用户数据
      await MongodbService.updateUser({
        uid: ctx.from?.id,
        dailyPoints: userData.dailyPoints,
        points: userData.points,
      });
    }
  }

  //监听指定话题，处理加分  
  static async handleThreadIdMessage(ctx: Context) {
    const TARGET_THREAD_ID = [107537, 20, 1677, 54];

    //const channelId = ctx.chat?.id;
    const message = ctx.message;
    const userId = ctx.from?.id;

    //if (channelId !== TARGET_CHANNEL_ID) return; // 只处理指定频道的消息
    if (!message || !("text" in message)) return; // 只处理文本消息
    if (!userId) return; // 无法识别用户，直接忽略

    const messageText = message.text.trim(); // 确保获取文本
    const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split('/').join('-'); // YYYY-MM-DD

    // 查询用户
    const user = await MongodbService.getUser(userId);
    if (!user) {
      console.log(`⚠️ 未找到用户 ID: ${userId}`);
      return;
    }


    // 更新数据库
    const threadId = ctx.message.message_thread_id;
    console.log("threadId/TARGET_THREAD_ID[0]:", threadId, "/", TARGET_THREAD_ID[0]);

    if (threadId === TARGET_THREAD_ID[0]) {
      const lastSubmitedDay = new Date(user?.lastSubmited).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split("T")[0].split('/').join('-');
      const joinedDay = new Date(user.joinedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split("T")[0].split('/').join('-');
      const isAdmin = await MessageCommand.isUserAdmin(ctx, user.uid);

      if (!isAdmin && lastSubmitedDay === today && joinedDay !== today) {
        await ctx.reply(`⚠️ 警告！用户@${user.username},请勿重复提交参会登记！！！`);
        return;
      }

      const scoreMap: Record<string, number> = {
        "1": 10,
        "2": 20,
        "3": 30,
      };

      // // 检查 messageText 是否为数字
      // if (!/^\d+$/.test(messageText) && !isAdmin) {
      //   console.log(`⚠️ 用户 ${user.username} 输入的不是有效的数字: ${messageText}`);
      //   await ctx.reply(`⚠️ 无效的输入，请输入有效的数字以获取积分。`);
      //   return;
      // }

      // 计算新积分
      const score = scoreMap[messageText];
      if (score === undefined && !isAdmin) {
        console.log(`⚠️ 用户 ${user.username} 输入的数字不在积分映射中: ${messageText}`);
        await ctx.reply(`⚠️ 输入的数字不在有效范围内，请输入 1, 2 或 3。`);
        return;
      }

      if (/^\d+$/.test(messageText)) {
        const newScore = (user?.meetingPoints || 0) + score;

        await MongodbService.updateUser({
          uid: userId,
          meetingPoints: newScore,
          lastSubmited: new Date(),
        });

        console.log(`✅ 用户${user?.username}(${userId}) 发送 ${messageText}，加 ${score} 分，总分 ${newScore}`);
      }
    }
    else {
      // 定义 Twitter 状态链接的正则表达式
      const twitterLinkPattern = /^https:\/\/x\.com\/\w+\/status\/\d+$/;
      const twitterLinkPattern2 = /^https:\/\/x\.com\/\w+\/status\/\d+\?s=\d+$/;
      if (twitterLinkPattern.test(messageText) || twitterLinkPattern2.test(messageText)) {
        // 提取用户名和状态 ID

        const index = messageText.indexOf('?');
        const newUrl = index !== -1 ? messageText.substring(0, index) : messageText;
        const match = newUrl.match(/^https:\/\/x\.com\/(\w+)\/status\/(\d+)$/);
        if (match) {
          const x_username = match[1];
          const statusId = match[2];

          let score = 0;
          switch (threadId) {
            case TARGET_THREAD_ID[1]://中文推20
              score += 3;
              break;
            case TARGET_THREAD_ID[2]://英文推1677
              score += 5;
              break;
            case TARGET_THREAD_ID[3]://深度推文54
              score += 10;
              break;
            default:
              break;
          }

          const newScore = (user.twitterPoints || 0) + score;
          const user_x_username = user.x_uername;

          let new_xusername = "";
          if (!user_x_username) {//为空，新添加           
            new_xusername = x_username;
          }
          else {
            const xusernames = user_x_username.split(';')
            if (!xusernames.includes(x_username)) {//不存在，新添加              
              new_xusername = user_x_username + ";" + x_username;
            }
            else {
              new_xusername = user_x_username;//已存在，不修改
            }
          }

          await MongodbService.updateUser({
            uid: userId,
            twitterPoints: newScore,
            x_uername: new_xusername,
            //lastSubmited: new Date(),
          });
          console.log(`✅ 用户 ${user.username}(${userId})  的 twitter ${messageText}，加 ${score} 分`);
        }

      }
      else {
        console.log(`⚠️ 用户 ${user.username} 的 twitter ${messageText} 加 0 分`);
      }
    }

  }
  // 示例的 isUserAdmin 方法
  static async isUserAdmin(ctx: CustomContext, userId: number): Promise<boolean> {
    const chatId = ctx.chat?.id;
    if (!chatId) return false;

    try {
      const member = await ctx.telegram.getChatMember(chatId, userId);
      return member.status === 'administrator' || member.status === 'creator';
    } catch (error) {
      console.error('Error checking user admin status:', error);
      return false;
    }
  }
}