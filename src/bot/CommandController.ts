import { MongodbService } from '../services/MongodbApiService';
import { User, UserModel } from '../models/DatabaseModels';
import { CustomContext, ExtendedTextMessage } from '../models/TelegramTypes';

import { Telegraf } from 'telegraf';
import { Context } from 'telegraf';
import LotteryScheduler from '../scheduler/LotteryScheduler';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { MessageCommand } from '../commands/MessageCommand';
import { UserCommand } from '../commands/UserCommand';
import { LotteryCommand } from '../commands/LotteryCommand';
import { TwitterCommand } from '../commands/TwitterCommand';
import { RankingCommand } from '../commands/RankingCommand';

export class CommandController {
  private getLotteryScheduler: (chatId: number) => LotteryScheduler | undefined;
  private bot: Telegraf<CustomContext>;

  constructor(private db: MongodbService, getLotteryScheduler: (chatId: number) => LotteryScheduler | undefined, bot: Telegraf<CustomContext>) {
    this.getLotteryScheduler = getLotteryScheduler;
    this.bot = bot;
  }

  // 处理消息
  async handleMessage(ctx: CustomContext, threadId: number) {
    const message = ctx.message as ExtendedTextMessage | undefined;
    if (!message?.text) return;

    //console.log('处理消息:', message.text);

    const { id: userId, first_name: firstName, last_name: lastName, username } = ctx.from || {};
    const chatId = ctx.chat?.id;
    const TARGET_CHAT_ID = -1002090542152; // 目标群ID
    const LOTTERY_POINTS_THRESHOLD = 10; // 抽奖积分阈值

    if (!userId) return; // 无法识别用户，直接忽略

    let userData = await UserCommand.updateUserInfo(userId, firstName, lastName, username);

    if (!userData) return;

    // 确保 userData 的所有字段已初始化
    if (userData.points === undefined) userData.points = 0;
    if (userData.dailyPoints === undefined) userData.dailyPoints = 0;
    if (userData.notifiedForLottery === undefined) userData.notifiedForLottery = false;

    const today = this.getCurrentDate();
    UserCommand.resetDailyPointsIfNeeded(userData, today);

    // 只处理指定群的消息
    if (chatId === TARGET_CHAT_ID) {
      console.log('处理目标群', "chatId:", chatId, "消息：", message.text);
      UserCommand.handleTargetChatMessage(userData, message.text);
    }

    // 检查是否达到抽奖条件
    //console.log('handleLotteryParticipation: userData.dailyPoints:', userData.dailyPoints, 'userData.notifiedForLottery:', userData.notifiedForLottery, 'chatId:', chatId);
    
    // const canParticipateInLottery = userData.dailyPoints >= 10 && !userData.notifiedForLottery;
    // if (canParticipateInLottery && chatId === TARGET_CHAT_ID) {
    //     await LotteryCommand.handleLotteryParticipation(ctx, userId, userData);
    // }

    // 将魔法数字提取为配置常量（建议放在类/模块顶部或配置文件中）


    // 抽奖资格检查逻辑
    const hasSufficientPoints = (userData.dailyPoints ?? 0) >= LOTTERY_POINTS_THRESHOLD;
    const isNotNotified = !userData.notifiedForLottery;
    const isTargetChat = chatId === TARGET_CHAT_ID;

    if (hasSufficientPoints && isNotNotified && isTargetChat) {
      console.log(`[Lottery] 用户 ${userId} 满足抽奖条件`, {
        dailyPoints: userData.dailyPoints,
        notified: userData.notifiedForLottery,
        chatId
      });

      try {
        await LotteryCommand.handleLotteryParticipation(ctx, userId, userData);
        console.log(`[Lottery] 用户 ${userId} 抽奖处理成功`);
      } catch (error) {
        console.error(`[Lottery] 用户 ${userId} 抽奖失败`, {
          // error: error instanceof Error ? error.message : 'Unknown error',
          // stack: error instanceof Error ? error.stack : undefined
        });
        // 可选：重试逻辑/错误上报
      }
    }

  }


  // 获取当前日期（格式：yyyy-mm-dd）
  private getCurrentDate(): string {
    return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).split('/').join('-');
  }



  // 生成邀请链接
  public async generateInviteLink(ctx: CustomContext) {
    return UserCommand.generateInviteLink(ctx, this.bot);
  }


  // 处理新用户加入
  public async handleNewMember(ctx: CustomContext) {
    UserCommand.handleNewMember(ctx);
  }


  //监听指定话题，处理加分  
  async handleThreadIdMessage(ctx: Context) {
    return MessageCommand.handleThreadIdMessage(ctx);
  }


  //更新中奖积分（统计发言）
  async updateLottery(winners: number[]): Promise<void> {
    LotteryCommand.updateLottery(winners);
  }



  async showMyScore(ctx: CustomContext) {
    UserCommand.showMyScore(ctx);
  }

  // 命令菜单Inline Keyboard
  async showMainMenu(ctx: CustomContext) {
    const menu = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "积分排名", callback_data: "s_total_score_ranking" },
            { text: "活跃排名", callback_data: "s_total_points_ranking" },
          ],
          [
            { text: "总发言排名", callback_data: "s_messages_ranking" },
            { text: "今日活跃排名", callback_data: "s_dialy_points_ranking" },
          ],
          [
            { text: "冲推积分排名", callback_data: "s_twitter_ranking" },
            { text: "中奖积分排名", callback_data: "s_lottery_ranking" },
          ],
          [
            { text: "捐赠积分排名", callback_data: "s_donate_ranking" },
            { text: "特殊贡献排名", callback_data: "s_special_ranking" },
          ],
          [
            { text: "邀请积分排名", callback_data: "s_invite_ranking" },
            { text: "会议积分排名", callback_data: "s_meeting_ranking" },
          ],
          [
            { text: "邀请链接", callback_data: "s_invite_link" },
            { text: "创建抽奖", callback_data: "s_create_lottery" },
          ],
          [
            { text: "帮助", callback_data: "s_helpme" },
          ]
        ],
      },
    };

    await ctx.reply("请选择一个命令：", menu);
  };

  //查询排行榜
  async showMessagesSentRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.MessagesSentRanking(ctx, page, pageSize);
  }

  async showTotalScoreRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.TotalScoreRanking(ctx, page, pageSize);
  }

  async showPointsRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.PointsRanking(ctx, page, pageSize);
  }

  async showDialyPointsRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.DialyPointsRanking(ctx, page, pageSize);
  }

  async showInviteRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.InviteRanking(ctx, page, pageSize);
  }

  async showTwitterRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.TwitterRanking(ctx, page, pageSize);
  }

  async showMeetingRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.MeetingRanking(ctx, page, pageSize);
  }

  async showLotteryRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.LotteryRanking(ctx, page, pageSize);
  }

  async showDonateRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.DonateRanking(ctx, page, pageSize);
  }

  async showSpecialRanking(ctx: CustomContext, page: number = 1, pageSize: number = 10) {
    return RankingCommand.SpecialRanking(ctx, page, pageSize);
  }


  // 处理推特请求
  public async handleJoinTwitterCampaign(ctx: CustomContext) {
    return TwitterCommand.handleJoinTwitterCampaign(ctx);
  }

  public async handlePageRequest(ctx: CustomContext, page: number, pageSize: number, title: string, callback_data: string, queryFieldString: string) {
    return RankingCommand.handlePageRequest(ctx, page, pageSize, title, callback_data, queryFieldString);
  }

 
  private async generateTwitterAuthLink(userId: number): Promise<string> {
    return TwitterCommand.generateTwitterAuthLink(userId);
  }

  public async handleTwitterCallback(ctx: CustomContext) {
    return TwitterCommand.handleTwitterCallback(ctx);
  }

  private async getTwitterAccessToken(oauthToken: string, oauthVerifier: string): Promise<{ accessToken: string, accessSecret: string }> {
    // 获取推特访问令牌的逻辑
    // 这里假设我们有一个方法可以获取访问令牌
    return TwitterCommand.getTwitterAccessToken(oauthToken, oauthVerifier);
  }

  // 显示当前抽奖信息
  async showCurrentLottery(ctx: CustomContext) {
    return LotteryCommand.showCurrentLottery(ctx);
  }
}
