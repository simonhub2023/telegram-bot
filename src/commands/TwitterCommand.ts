import { CallbackQuery } from "telegraf/typings/core/types/typegram";
import { CustomContext } from "../models/TelegramTypes";
import { MongodbService } from "../services/MongodbApiService";

export class TwitterCommand {

// 处理推特请求
static async handleJoinTwitterCampaign(ctx: CustomContext) {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;

    if (!chatId || !userId) {
      await ctx.reply('无法获取聊天或用户信息，请稍后再试。');
      return;
    }

    // 检查用户是否已经授权
    const user = await MongodbService.getUser(userId);
    if (user && user.twitterAccessToken && user.twitterAccessSecret) {
      await ctx.reply('您已经参与了自动冲推活动。');
      return;
    }

    // 发送授权链接
    const authLink = await this.generateTwitterAuthLink(userId);
    await ctx.reply(`请点击以下链接授权您的推特账号：\n${authLink}`);
  }

 static async generateTwitterAuthLink(userId: number): Promise<string> {
    try {
      // Generate a random state value for security
      const state = Buffer.from(userId.toString()).toString('base64');
      
      // Twitter OAuth 2.0 parameters
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.TWITTER_CLIENT_ID || '', // Make sure this is set in your .env
        redirect_uri: process.env.TWITTER_REDIRECT_URI || '', // Make sure this is set in your .env
        scope: 'tweet.read tweet.write users.read offline.access',
        state: state,
        code_challenge_method: 'plain',
        code_challenge: 'challenge', // In production, generate a proper PKCE challenge
      });
  
      // Construct the authorization URL
      const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
      
      // Store the state temporarily (you might want to save this in your database)
      MongodbService.updateTwitterAuthState({
        userId: userId,
        twitterAuthState: state,
      });
  
      return authUrl;
    } catch (error) {
      console.error('Error generating Twitter auth link:', error);
      throw new Error('Failed to generate Twitter authorization link');
    }
  }

 static async handleTwitterCallback(ctx: CustomContext) {
    const query = (ctx.callbackQuery as CallbackQuery.DataQuery)?.data;
    if (!query) {
      await ctx.reply('授权失败，请重试。');
      return;
    }

    const [userId, oauthToken, oauthVerifier] = query.split(':');
    const user = await MongodbService.getUser(parseInt(userId));

    if (!user) {
      await ctx.reply('用户信息获取失败，请重试。');
      return;
    }

    // 获取推特访问令牌
    const { accessToken, accessSecret } = await this.getTwitterAccessToken(oauthToken, oauthVerifier);

    // 更新用户信息
    await MongodbService.updateUser({
      uid: parseInt(userId),
      twitterAccessToken: accessToken,
      twitterAccessSecret: accessSecret,
    });

    await ctx.reply('推特授权成功，您已参与自动冲推活动。');
  }

  static async getTwitterAccessToken(oauthToken: string, oauthVerifier: string): Promise<{ accessToken: string, accessSecret: string }> {
    // 获取推特访问令牌的逻辑
    // 这里假设我们有一个方法可以获取访问令牌
    const url = `https://api.twitter.com/oauth/access_token?oauth_token=${oauthToken}&oauth_verifier=${oauthVerifier}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('data:', data);
    const accessToken = data.oauth_token;
    const accessSecret = data.oauth_token_secret;
    return { accessToken: accessToken, accessSecret: accessSecret };
    //return { accessToken: 'accessToken', accessSecret: 'accessSecret' };
  }


}
