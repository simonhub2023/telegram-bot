import { Telegraf, Context } from 'telegraf';
import { CommandController } from './CommandController';
import { MongodbService } from '../services/MongodbApiService';
import { CustomContext } from '../models/TelegramTypes';
import LotteryScheduler from '../scheduler/LotteryScheduler';
import TwitterScheduler from '../scheduler/TwitterScheduler';
import { TwitterApi } from 'twitter-api-v2';
import { OpenAI } from 'openai'; //Adjust the import path as necessary

export class TelegramBot {
  private bot: Telegraf<CustomContext>;
  private controller: CommandController;
  private lotterySchedulers: Map<number, LotteryScheduler> = new Map();
  //private twitterScheduler: TwitterScheduler;

  constructor(token: string) {
    //const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY!,
      appSecret: process.env.TWITTER_APP_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });

    this.bot = new Telegraf<CustomContext>(token);
    this.controller = new CommandController(new MongodbService(), this.getLotteryScheduler.bind(this), this.bot);

    //this.twitterScheduler = new TwitterScheduler(twitterClient, new MongodbService(), openai, this.bot);
    this.registerCommands();
    this.registerHandlers();
  }

  private getLotteryScheduler(chatId: number): LotteryScheduler | undefined {
    return this.lotterySchedulers.get(chatId);
  }

  // 检查用户是否是管理员
  private async isAdmin(ctx: CustomContext, userId: number): Promise<boolean> {
    const chatId = ctx.chat?.id;
    if (!chatId) return false;

    try {
      const member = await ctx.telegram.getChatMember(chatId, userId);
      return ['administrator', 'creator'].includes(member.status);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  // 注册命令列表
  private async registerCommands() {
    await this.bot.telegram.setMyCommands([
      { command: 's_start', description: '打开功能菜单' },
      { command: 's_total_score_ranking', description: '积分排名' },
      { command: 's_messages_ranking', description: '发言排名' },
      { command: 's_total_points_ranking', description: '活跃积分排名' },
      { command: 's_dialy_points_ranking', description: '今日活跃排名' },
      { command: 's_meeting_ranking', description: '会议积分排名' },
      { command: 's_twitter_ranking', description: '冲推积分排名' },
      { command: 's_lottery_ranking', description: '中奖积分排名' },
      { command: 's_donate_ranking', description: '捐赠积分排名' },
      { command: 's_special_ranking', description: '特殊贡献排名' },
      { command: 's_invite_ranking', description: '邀请积分排名' },
      { command: 's_invite_link', description: '生成邀请链接' },
      { command: 's_create_lottery', description: '创建抽奖' },
      { command: 's_join_twitter_campaign', description: '参与冲推' }, // 新增命令
      { command: 's_helpme', description: '获取帮助' },
    ]);
  }

  // 监听和单独注册命令
  private registerHandlers() {
    // 当用户触发 "/start" 时显示菜单
    this.bot.command('s_start', async (ctx) => {
      this.controller.showMainMenu(ctx);
    });



    // 处理按钮点击事件
    this.bot.on('callback_query', async (ctx) => {
      const pageSize = 10;
      const message = ctx.callbackQuery?.message;
      const title = message && 'text' in message
        ? message.text.split('\n')[0].replace(/^🏆\s*/, '').replace(/:/g, '')  // 去掉前面的🏆和所有的:
        : "";
      const callbackData = (ctx.callbackQuery as { data: string })?.data;

      if (!callbackData) {
        return;
      }

      try {
        if (callbackData === 'no_more') {
          await ctx.answerCbQuery('没有更多了', { show_alert: true });
          return;
        }

        const match = callbackData.match(/rank_page_(\d+)_(.+)/);
        if (match) {
          const page = parseInt(match[1], 10);
          const queryField = match[2];

          await this.controller.handlePageRequest(
            ctx,
            Math.max(1, page),
            pageSize,
            title,
            callbackData,
            queryField
          );
          return;
        }

        switch (callbackData) {
          case 's_total_score_ranking':
            this.controller.showTotalScoreRanking(ctx);
            break;
          case 's_messages_ranking':
            this.controller.showMessagesSentRanking(ctx);
            break;
          case 's_total_points_ranking':
            this.controller.showPointsRanking(ctx);
            break;
          case 's_dialy_points_ranking':
            this.controller.showDialyPointsRanking(ctx);
            break;
          case 's_invite_ranking':
            this.controller.showInviteRanking(ctx);
            break;
          case 's_twitter_ranking':
            this.controller.showTwitterRanking(ctx);
            break;
          case 's_meeting_ranking':
            this.controller.showMeetingRanking(ctx);
            break;
          case 's_lottery_ranking':
            this.controller.showLotteryRanking(ctx);
            break;
          case 's_donate_ranking':
            this.controller.showDonateRanking(ctx);
            break;
          case 's_special_ranking':
            this.controller.showSpecialRanking(ctx);
            break;
          case 's_invite_link':
            this.controller.generateInviteLink(ctx);
            break;
          case 's_join_twitter_campaign':
            this.controller.handleJoinTwitterCampaign(ctx);
            break;
          case 's_create_lottery':
            const chatId = ctx.chat?.id;
            if (chatId !== undefined) {
              try {
                const lotteryScheduler = this.getLotteryScheduler(chatId);
                if (lotteryScheduler) {
                  await lotteryScheduler.createLottery();
                  await ctx.reply('抽奖活动已创建！');
                } else {
                  await ctx.reply('无法创建抽奖活动，请稍后再试。');
                }
              } catch (error) {
                //console.error('Error creating lottery:', error);
                await ctx.reply('抽奖活动已存在，创建失败。');
              }
            } else {
              await ctx.reply('无法创建抽奖活动，请稍后再试。');
            }
            break;
          case 's_helpme':
            await ctx.reply('请选择功能，或者输入"/命令"操作...');
            break;
          default:
            break;
        }
        // 取消按钮点击后，移除按钮
        await ctx.answerCbQuery();
      } catch (error) {
        console.error('Error handling callback:', error);
        if (error instanceof Error && error.message.includes('message is not modified')) {
          await ctx.answerCbQuery('当前页面未发生变化');
          return;
        }
        await ctx.answerCbQuery('处理请求时出错');
      }
    });

    //发言排名
    this.bot.command('s_messages_ranking', async (ctx) => {
      console.log("Received /messages_ranking command");
      this.controller.showMessagesSentRanking(ctx)
    });
    //总积分排名
    this.bot.command('s_total_score_ranking', async (ctx) => {
      console.log("Received /total_points_ranking command");
      this.controller.showTotalScoreRanking(ctx)
    });
    //总活跃积分排名y

    this.bot.command('s_total_points_ranking', async (ctx) => {
      console.log("Received /today_points_ranking command");
      this.controller.showPointsRanking(ctx)
    });
    //每日活跃排名
    this.bot.command('s_dialy_points_ranking', async (ctx) => {
      console.log("Received /dialy_points_ranking command");
      this.controller.showDialyPointsRanking(ctx)
    });
    //邀请排名
    this.bot.command('s_invite_ranking', async (ctx) => {
      console.log("Received /invite_ranking command");
      this.controller.showInviteRanking(ctx)
    });
    //冲推排名
    this.bot.command('s_twitter_ranking', async (ctx) => {
      console.log("Received /twitter_ranking command");
      this.controller.showTwitterRanking(ctx)
    });
    //会议排名
    this.bot.command('s_meeting_ranking', async (ctx) => {
      console.log("Received /meeting_ranking command");
      this.controller.showMeetingRanking(ctx)
    });
    //抽奖排名
    this.bot.command('s_lottery_ranking', async (ctx) => {
      console.log("Received /lottery_ranking command");
      this.controller.showLotteryRanking(ctx)
    });
    //捐赠排名
    this.bot.command('s_donate_ranking', async (ctx) => {
      console.log("Received /donate_ranking command");
      this.controller.showDonateRanking(ctx)
    });
    //特殊贡献排名
    this.bot.command('s_special_ranking', async (ctx) => {
      console.log("Received /special_ranking command");
      this.controller.showSpecialRanking(ctx)
    });
    //生成邀请链接
    this.bot.command('s_invite_link', async (ctx) => {
      await this.controller.generateInviteLink(ctx);
    });
    //参与冲推
    this.bot.command('s_join_twitter_campaign', async (ctx) => {
      await this.controller.handleJoinTwitterCampaign(ctx);
    });

    // 定义常量
    const TARGET_CHAT_ID = -1002090542152;//加分目标群ID
    const TARGET_THREAD_ID = [107537, 20, 1677, 54];//加分目标话题ID
    const RESTRICT_THREAD_ID = [1277, 1288];//禁言话题ID

    //创建抽奖
    this.bot.command('s_create_lottery', async (ctx) => {
      const chatId = ctx.chat.id;
      console.log("Received /create_lottery command, chatId:", chatId);


      if (chatId == TARGET_CHAT_ID) {
        let lotteryScheduler = this.lotterySchedulers.get(chatId);
        console.log("lotteryScheduler:", lotteryScheduler);
        if (!lotteryScheduler) {
          lotteryScheduler = new LotteryScheduler(this.bot, new MongodbService(), chatId);
          lotteryScheduler.start();//启动抽奖调度器
          this.lotterySchedulers.set(chatId, lotteryScheduler);//将抽奖调度器存入Map
          console.log(`Started LotteryScheduler for chatId: ${chatId}`);
        }
        try {
          await lotteryScheduler.createLottery();
          await ctx.reply('抽奖活动已创建！');
        } catch (error) {
          //console.error('Error creating lottery:', error);
          await ctx.reply('抽奖活动已存在，创建失败。');
        }
      }
      else {
        await ctx.reply('该群无法创建抽奖活动，请联系管理员。');
      }
    });


    // 第一层中间件：基础过滤
    this.bot.use(async (ctx, next) => {
      // 仅处理文本消息
      if (!ctx.message || !('text' in ctx.message)) return next();

      // 标记为已处理文本消息
      ctx.state.isTextMessage = true;
      return next();
    });

    // 第二层中间件：话题验证
    this.bot.use(async (ctx, next) => {
      if (!ctx.state.isTextMessage) return next();

      // 验证话题ID（如果需要严格限制）
      const threadId = ctx.message?.message_thread_id;

      console.log("threadId:", threadId);
      // 验证是否目标话题加分(会议/冲推登记)
      if (!threadId) return next();

      if (TARGET_THREAD_ID.includes(threadId)) {
        ctx.state.isTargetThread = true;
      }

      // 验证是否限制发言(禁言)     
      if (RESTRICT_THREAD_ID.includes(threadId)) {
        ctx.state.isRestrictThread = true;
        console.log("isRestrictThread_ID:", threadId);
      }

      return next();
    });

    // 第三层中间件：限制非管理员发言
    // this.bot.use(async (ctx, next) => {
    //   if (!ctx.state.isRestrictThread) return next();

    //   const userId = ctx.from?.id;
    //   if (!userId) return next();

    //   const isAdmin = await this.isAdmin(ctx, userId);
    //   if (!ctx.chat) {
    //     console.log("chat:", ctx.chat);
    //     return next();
    //   }

    //   if (!isAdmin) {        
    //     await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
    //       permissions: {
    //         can_send_messages: false,
    //         //can_send_media_messages: false,
    //         can_send_polls: false,
    //         can_send_audios: false,
    //         can_send_documents: false,
    //         can_send_photos: false,
    //         can_send_videos: false,
    //         can_send_video_notes: false,
    //         can_send_voice_notes: false,
    //         can_send_other_messages: false,
    //         can_add_web_page_previews: false,
    //         can_change_info: false,
    //         can_invite_users: false,
    //         can_pin_messages: false,
    //       },
    //     });
    //     return;
    //   }

    //   return next();
    // });

    // 指令处理（支持任意话题）
    this.bot.hears(['我的积分', 'score'], async (ctx) => {
      await this.controller.showMyScore(ctx);
    });

    this.bot.hears(['新积分排行', '积分排名', 's_scoreranking'], async (ctx) => {
      await this.controller.showTotalScoreRanking(ctx);
    });
    // 指令处理（获取邀请链接）
    this.bot.hears(['邀请链接', 's_inviteLink', '我的邀请链接'], async (ctx) => {
      await this.controller.generateInviteLink(ctx);
    });

    // 指令处理（获取当前抽奖活动）
    this.bot.hears(['抽奖活动', '当前抽奖活动'], async (ctx) => {
      await this.controller.showCurrentLottery(ctx);
    });

    // 通用消息处理
    this.bot.on('message', async (ctx) => {

      const chatId = ctx.chat.id;
      const userId = ctx.from.id;
      let threadId = ctx.message.message_thread_id;
      // if(threadId = "undefinded"){
      //   threadId == 0 ;
      // }
      console.log("Telegram ChatId: ", chatId, " userId:", userId);
      if (!this.lotterySchedulers.has(chatId) && chatId == TARGET_CHAT_ID) {
        const lotteryScheduler = new LotteryScheduler(this.bot, new MongodbService(), chatId);
        lotteryScheduler.start();
        this.lotterySchedulers.set(chatId, lotteryScheduler);
        console.log(`Started LotteryScheduler for chatId: ${chatId}`);
      }

      if (!ctx.state.isTextMessage) return;

      // 基础处理
      await this.controller.handleMessage(ctx, threadId ? threadId : 0);

      // 目标话题加分专属处理
      if (ctx.state.isTargetThread) {
        await this.controller.handleThreadIdMessage(ctx);
      }
    });


    // 监听新成员加入
    this.bot.on('new_chat_members', async (ctx) => {
      await this.controller.handleNewMember(ctx);
    });
  }

  public start() {
    this.bot.launch();
    //this.twitterScheduler.start();
    console.log('Bot 已启动！');
  }
}