import cron from 'node-cron';
import { TwitterApi } from 'twitter-api-v2';
import { MongodbService } from '../services/MongodbApiService';
import axios from 'axios';
import { OpenAI } from 'openai';

import { Telegraf } from 'telegraf';

class TwitterScheduler {
  private twitterClient: TwitterApi;
  private dbService: MongodbService;
  private openai: OpenAI;
  private bot: Telegraf;
  constructor(twitterClient: TwitterApi, dbService: MongodbService, openai: OpenAI, bot: Telegraf) {
    this.twitterClient = twitterClient;
    this.dbService = dbService;
    this.openai = openai;
    this.bot = bot;
  }

  public start() {
    // Schedule the task to run every day at 12:00 PM (Asia/Shanghai time)
    cron.schedule('0 12 * * *', async () => {
      const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      console.log(`Running Twitter tasks at ${now}`);

      // Fetch the users from the database
      const users = await this.dbService.getAllUsers();

      for (const user of users) {
        if (user.twitterAccessToken && user.twitterAccessSecret) {
          const twitterUsernames = user.x_uername ? user.x_uername.split(';') : [];
          for (const [index, username] of twitterUsernames.entries()) {
            // Add delay between each API call to respect Twitter rate limits
            setTimeout(async () => {
              //await this.likeAndRetweet(username);
              await this.likeRetweetAndComment(username);

              // 给用户加分
              const newScore = user.twitterPoints + 10;
              await MongodbService.updateUser({
                uid: user.uid,
                twitterPoints: newScore,
                x_uername: username,        
              });
                console.log(`Liked, retweeted, and commented for user ${username} successfully，newScore: ${newScore}`);

              // 回复用户当天冲推任务已经完成
              await this.bot.telegram.sendMessage(user.uid, `您今天的冲推任务已经完成，总共活动积分奖励 ${user.lotteryPoints + 10} 分。`);
            }, index * 60000); // 1 minute delay between each call
          }
        }
      }
    }, {
      scheduled: true,
      timezone: "Asia/Shanghai"
    });
  }

  //like and retweet
  private async likeAndRetweet(username: string) {
    try {
      // Fetch the latest tweet from the user
      const user = await this.twitterClient.v2.userByUsername(username);
      const tweets = await this.twitterClient.v2.userTimeline(user.data.id, { max_results: 1 });

      if (tweets.meta.result_count > 0) {
        const tweetId = tweets.data.data[0].id;
        console.log(`Found tweet ${tweetId} from user ${username}`);

        // Like the tweet
        await this.twitterClient.v2.like(user.data.id, tweetId);
        console.log(`Liked tweet ${tweetId} from user ${username}`);

        // Retweet the tweet
        await this.twitterClient.v2.retweet(user.data.id, tweetId);
        console.log(`Retweeted tweet ${tweetId} from user ${username}`);
      }
    } catch (error) {
      console.error(`Failed to like and retweet for user ${username}:`, error);
    }
  }


//like,reteet and comment 
private async likeRetweetAndComment(username: string) {
    try {
      // Fetch the latest tweet from the user
      const user = await this.twitterClient.v2.userByUsername(username);
      const tweets = await this.twitterClient.v2.userTimeline(user.data.id, { max_results: 1 });

      if (tweets.meta.result_count > 0) {
        const tweetId = tweets.data.data[0].id;
        const tweetText = tweets.data.data[0].text;
        console.log(`Found tweet ${tweetId} from user ${username}: ${tweetText}`);

        // Like the tweet
        await this.twitterClient.v2.like(user.data.id, tweetId);
        console.log(`Liked tweet ${tweetId} from user ${username}`);

        // Retweet the tweet
        await this.twitterClient.v2.retweet(user.data.id, tweetId);
        console.log(`Retweeted tweet ${tweetId} from user ${username}`);

        // Generate a comment using OpenAI
        //const comment = await this.generateCommentByOpenAi(tweetText);
       // const comment2 = await this.generateCommentByDeepSeek(tweetText);
       // console.log(`OpenAI comment1: ${comment}`, `DeepSeek comment2: ${comment2}`);

        // Comment on the tweet
        //await this.twitterClient.v2.reply(comment, tweetId);
        console.log(`Commented on tweet ${tweetId} from user ${username}:`);
      }
    } catch (error) {
      console.error(`Failed to like, retweet, and comment for user ${username}:`, error);
    }
  }

  //use OpenAI to generate a comment
  private async generateCommentByOpenAi(tweetText: string): Promise<string> {
    try {
      const response = await this.openai.completions.create({
        model: 'text-davinci-003',
        prompt: `Read the following tweet and generate a relevant comment:\n\n"${tweetText}"\n\nComment:`,
        max_tokens: 50,
      });

      return response.choices[0].text.trim();
    } catch (error) {
      console.error('Failed to generate comment:', error);
      return 'Great tweet!';
    }
  }

  //use DeepSeek to generate a comment
  private async generateCommentByDeepSeek(tweetText: string): Promise<string> {
    try {
      const response = await axios.post('https://api.deepseek.ai/generate-comment', {
        prompt: `Read the following tweet and generate a relevant comment:\n\n"${tweetText}"\n\nComment:`,
        max_tokens: 50,
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      return response.data.comment.trim();
    } catch (error) {
      console.error('Failed to generate comment:', error);
      return 'Great tweet!';
    }
  }

}

export default TwitterScheduler;