import { Telegraf } from "telegraf";
import { UserModel } from "../models/DatabaseModels";
import { CustomContext, PaginationConfig } from "../models/TelegramTypes";
import { PaginationService } from "../services/PageinationService";

type RankUser = {
  uid: number;
  username?: string;
  firstName: string;
  lastName?: string;
  [key: string]: any;
};

export class RankingCommand {
  static bot: Telegraf;

  // 1查看发言排名MessagesSentRanking
  static async MessagesSentRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show messagesSent ranking...');
    try {
      const users = await UserModel.find().sort({ messagesSent: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "messagesSent", page, '总发言排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 2查看总积分排名TotalPointsRanking
  static async TotalScoreRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show total_points_ranking...');
    try {
      const users = await UserModel.aggregate([
        {
          $addFields: {
            totalPoints: {
              $add: [
                { $ifNull: ["$points", 0] },
                { $ifNull: ["$invitePoints", 0] },
                { $ifNull: ["$twitterPoints", 0] },
                { $ifNull: ["$meetingPoints", 0] },
                { $ifNull: ["$lotteryPoints", 0] },
                { $ifNull: ["$donatePoints", 0] },
                { $ifNull: ["$specialPoints", 0] },
              ],
            },
          },
        },
        {
          $sort: { totalPoints: -1 },
        },
      ]);

      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }

      await this.generatePagedReply(ctx, users, "totalPoints", page, '总积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 查看总活跃积分排名TotalPointsRanking
  static async PointsRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show total_points_ranking...');
    try {
      const users = await UserModel.find().sort({ points: -1 }).exec();
      await this.generatePagedReply(ctx, users, "points", page, '群活跃积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 查看今日活跃积分排名DialyPointsRanking
  static async DialyPointsRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show dialy_points_ranking...');
    const currentDate = new Date();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    // 将中文区的0点时间转换为 UTC 时间
    const todayStartUTC = new Date(todayStart).toISOString();
    try {
      // 更新所有 lastUpdated 不等于今天的用户的 dailyPoints 为 0
      console.log('todayStart:', todayStart, ' todayStartUTC:', todayStartUTC);
      await UserModel.updateMany(
        {
          lastUpdated: { $lt: new Date(todayStartUTC) }
        },
        { $set: { dailyPoints: 0, lastUpdated: currentDate } }
      );

      const users = await UserModel.find().sort({ dailyPoints: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "dailyPoints", page, '今日积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 3查看邀请排名InviteRanking
  static async InviteRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show invite_ranking...');
    try {
      const users = await UserModel.find().sort({ invitePoints: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "invitePoints", page, '邀请积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 4查看冲推排名TwitterRanking
  static async TwitterRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show twitter_ranking...');
    try {
      const users = await UserModel.find().sort({ twitterPoints: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "twitterPoints", page, '冲推积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 5查看会议排名MeetingRanking
  static async MeetingRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show meeting_ranking...');
    try {
      const users = await UserModel.find().sort({ meetingPoints: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "meetingPoints", page, '会议积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 6查看抽奖排名LotteryRanking
  static async LotteryRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show lottery_ranking...');
    try {
      const users = await UserModel.find().sort({ lotteryPoints: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "lotteryPoints", page, '中奖积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 7查看捐赠排名DonateRanking
  static async DonateRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show lottery_ranking...');
    try {
      const users = await UserModel.find().sort({ donatePoints: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "donatePoints", page, '捐赠积分排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  // 8查看特殊加分排名SpecialRanking
  static async SpecialRanking(ctx: CustomContext, page: number = 1, pageSize: number = 20) {
    console.log('start show special_ranking...');
    try {
      const users = await UserModel.find().sort({ specialPoints: -1 }).exec();
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }
      await this.generatePagedReply(ctx, users, "specialPoints", page, '特殊贡献排名');
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }

  private static async getUpdatedRankingText(chatId: number, users: RankUser[], field: string, startRank: number, title: string): Promise<string> {
    return users
      .map((user, index) => {
        const rank = startRank + index + 1;  // 确保排名从正确的数字开始
        const value = user[field] || 0;
        const nickName = user.firstName + (user.lastName ? ' ' + user.lastName : '');
        const username = `<a href="tg://user?id=${user.uid}">${nickName}</a>`;
        return `${rank}. ${username} - ${value} 分`;
      })
      .join('\n');
  }

  static async generatePagedReply(
    ctx: CustomContext,
    users: RankUser[],
    queryField: string,
    page: number,
    title: string,
    config?: PaginationConfig
  ) {
    try {
      const { pageSize, maxPageButtons } = {
        ...PaginationService.DEFAULT_CONFIG,
        ...config
      };

      const totalItems = users.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const { startIndex, endIndex } = PaginationService.calculatePageRange(
        currentPage,
        pageSize,
        totalItems
      );

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const rankingText = await this.getUpdatedRankingText(
        chatId,
        users.slice(startIndex, endIndex),
        queryField,
        startIndex,
        title
      );

      const buttons = PaginationService.buildPaginationButtons(
        currentPage,
        totalPages,
        queryField
      );

      await this.sendMessage(ctx, rankingText, title, buttons);
    } catch (error) {
      console.error('生成分页消息失败:', error);
      await ctx.reply('暂时无法显示排行榜，请稍后再试');
    }
  }

  static async sendMessage(ctx: CustomContext, rankingText: string, title: string, buttons: any) {
    try {
      const messageText = `🏆 ::${title}::\n${rankingText}`;

      if (ctx.callbackQuery) {
        if (!ctx.callbackQuery.message) {
          throw new Error('No message to edit');
        }

        const result = await ctx.editMessageText(messageText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons }
        });
        await ctx.answerCbQuery();
      } else {
        const result = await ctx.reply(messageText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons }
        });
      }
    } catch (error) {
      console.error('Message update failed:', error);
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' && error.message.includes('message is not modified')) {
        await ctx.answerCbQuery('当前页面未发生变化');
        return;
      }

      try {
        const result = await ctx.reply(`🏆 ${title}:\n${rankingText}`, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons }
        });
        console.log('Fallback: New message sent successfully:', result);
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery('已刷新排行榜');
        }
      } catch (retryError) {
        console.error('Failed to send new message:', retryError);
        await ctx.reply('❌ 更新排行榜失败，请重试');
      }
    }
  }

  public static async handlePageRequest(ctx: CustomContext, page: number, pageSize: number, title: string, callback_data: string, queryFieldString: string) {
    try {
      let queryField = '';

      switch (callback_data) {
        case 's_total_score_ranking':
          queryField = 'totalPoints';
          break;
        case 's_messages_ranking':
          queryField = 'messagesSent';
          break;
        case 's_total_points_ranking':
          queryField = 'points';
          break;
        case 's_dialy_points_ranking':
          queryField = 'dailyPoints';
          break;
        case 's_invite_ranking':
          queryField = 'invitePoints';
          break;
        case 's_twitter_ranking':
          queryField = 'twitterPoints';
          break;
        case 's_meeting_ranking':
          queryField = 'meetingPoints';
          break;
        case 's_lottery_ranking':
          queryField = 'lotteryPoints';
          break;
        case 's_donate_ranking':
          queryField = 'donatePoints';
          break;
        case 's_special_ranking':
          queryField = 'specialPoints';
          break;
        default:
          break;
      }

      let users = [];

      if (queryField && queryField !== 'totalPoints') {
        users = await UserModel.find().sort({ [queryField]: -1 }).exec();
      } else {
        users = await UserModel.aggregate([
          {
            $addFields: {
              totalPoints: {
                $add: [
                  { $ifNull: ["$points", 0] },
                  { $ifNull: ["$invitePoints", 0] },
                  { $ifNull: ["$twitterPoints", 0] },
                  { $ifNull: ["$meetingPoints", 0] },
                  { $ifNull: ["$lotteryPoints", 0] },
                  { $ifNull: ["$donatePoints", 0] },
                  { $ifNull: ["$specialPoints", 0] },
                ],
              },
            },
          },
          {
            $sort: { totalPoints: -1 },
          },
        ]).exec();
      }
      if (!users.length) {
        await ctx.reply('暂无数据');
        return;
      }

      const match = callback_data.match(/rank_page_(\d+)_(.+)/);
      if (match) {
        queryField = queryFieldString;
      }

      await this.generatePagedReply(ctx, users, queryField, page, title);
    } catch (error) {
      console.error('获取排名失败:', error);
      await ctx.reply('❌ 获取排名失败');
    }
  }
}