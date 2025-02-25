import { UserModel, LotteryModel, User, ILottery, InviteModel, OAuthToken, OAuthTokenModel } from '../models/DatabaseModels';
import config from "../../config/config";

import { MongoClient, MongoErrorLabel } from "mongodb";
import mongoose from 'mongoose';

const uri = config.mongodbConnectionString;
let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000, // 增加连接超时（默认 30000ms）
      socketTimeoutMS: 30000, // 增加 socket 超时（默认 30000ms）
    });
    isConnected = true;
    console.log('数据库连接成功');
    return mongoose.connection;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

// 关闭数据库连接
export async function closeDatabaseConnection() {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    console.log('数据库连接已关闭');
  }
}


export class MongodbService {
  constructor() {
    connectToDatabase();
  }
  // 用户操作
  static async getUser(userId: number): Promise<User | null> {
    try {
      const user = await UserModel.findOne({ uid: userId });
      if (!user) {
        console.log(`用户未找到: ${userId}`);
        return null; // 明确返回 null
      }
      return user;
    } catch (error) {
      console.error(`查询用户时发生错误: ${error}`, { userId });
      throw new Error(`无法获取用户信息: ${userId}`); // 抛出更明确的错误
    }
  }

  static async updateUser(user: Partial<User>): Promise<User | null> {
    if (!user.uid) {
      throw new Error("User ID is required");
    }
    //console.log('db new.updateuser: uid:',user.uid);
    try {
      const updatedUser = await UserModel.findOneAndUpdate(
        { uid: user.uid },   // 查找条件：用户 ID
        { $set: user },       // 更新数据
        { upsert: true, new: true }  // 如果没有找到用户，则插入新记录，返回更新后的用户
      );
      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  async createLottery(lottery: ILottery): Promise<ILottery> {
    return LotteryModel.create(lottery);
  }

  async updateLotteryWinners(lotteryId: string, winnersId: number[]): Promise<ILottery | null> {
    try {
      const updateLotteryWinners = await LotteryModel.findByIdAndUpdate(
        lotteryId,
        { $set: { winners: winnersId } },
        { new: true }
      );      
      return updateLotteryWinners;
    } catch (error) {
      console.error("Error updating lotteryWinners:", error);
      throw error;
    }
  }

  async joinLottery(currentLotteryId: string, uid: number): Promise<void> {
    try {
      await LotteryModel.updateOne(
        { lotteryId: currentLotteryId },
        { $addToSet: { participants: { userId: uid, messageCount: 0 } } }
      );
      console.log('joinLottery success!');
    } catch (error) {
      console.error("Error joining lottery:", error);
      throw error;
    }
  }

  static async getLottery(currentLotteryId: string): Promise<ILottery | null> {
    const lottery = await LotteryModel.findOne({lotteryId: currentLotteryId});
    console.log("db lottery find :",lottery);
    if (!lottery || lottery.participants.length === 0) return null;
    return lottery;
  }


  async addLotteryPointsToUser(user: Partial<User>, prize: number): Promise<User | null> {
    if (!user.uid) {
      throw new Error("User ID is required");
    }

    const newPrize = (user.lotteryPoints ?? 0) + prize;
    console.log(`addLotteryPointsToUser ${user.username}, newPrize: ${newPrize}`);
    try {
      const updatedUser = await UserModel.findOneAndUpdate(
        { uid: user.uid },   // 查找条件：用户 ID
        { $set: { lotteryPoints: newPrize } },       // 更新数据
        { upsert: true, new: true }  // 如果没有找到用户，则插入新记录，返回更新后的用户
      );
      console.log('addLotteryPointsToUser updatedUser:', updatedUser);
      return updatedUser;
    } catch (error) {
      console.error("Error addLotteryPointsToUser to user:", error);
      throw error;
    }
  }

  public async getAllUsers(): Promise<User[]> {
    try {
      const users = await UserModel.find().exec();
      return users;
    } catch (error) {
      console.error("Error fetching all users:", error);
      throw error;
    }
  }

  public async getAllParticipants(): Promise<{ userId: number }[]> {
    try {
      const participants = await LotteryModel.aggregate([
        { $unwind: "$participants" },
        { $group: { _id: "$participants.userId" } },
        { $project: { _id: 0, userId: "$_id" } }
      ]).exec();
      console.log('getAllParticipants:', participants.length || 0);
      return participants;
    } catch (error) {
      console.error("Error fetching all participants:", error);
      throw error;
    }
  }

  public static async updateLotteryParticipants(currentLotteryId: string, participants: { userId: number, messageCount: number }[]): Promise<void> {
    try {
      await LotteryModel.findOneAndUpdate(
        { lotteryId: currentLotteryId },
        { $set: { participants } },
        { new: true }
      );
      console.log(`Lottery participants updated for lottery ID: ${currentLotteryId}`);
    } catch (error) {
      console.error("Error updating lottery participants:", error);
      throw error;
    }
  }

  public async updateLottery(currentLotteryId: string, updateData: Partial<ILottery>): Promise<void> {
    try {
      await LotteryModel.findOneAndUpdate(
        { lotteryId: currentLotteryId },
        { $set: updateData },
        { new: true }
      );
      console.log(`Lottery updated for lottery ID: ${currentLotteryId}`);
    } catch (error) {
      console.error("Error updating lottery:", error);
      throw error;
    }
  }
  

  
  static async updateTwitterAuthState(OAuthToken: Partial<OAuthToken>): Promise<OAuthToken | null> {
    if (!OAuthToken.userId) {
      throw new Error("User ID is required");
    }
    //console.log('mdbs.update: uid:',user.uid);
    try {
      const updatedUser = await OAuthTokenModel.findOneAndUpdate(
        { uid: OAuthToken.userId },   // 查找条件：用户 ID
        { $set: OAuthToken },       // 更新数据
        { upsert: true, new: true }  // 如果没有找到用户，则插入新记录，返回更新后的用户
      );
      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }


  public static async getLatestLottery(chatId: number, todayStartUTC: string): Promise<ILottery | null> {
    try {
      const lottery = await LotteryModel.findOne({
        chatId: chatId,
        createTime: { $gte: new Date(todayStartUTC) },
        isDrawn: false
      }).sort({ createTime: -1 }).exec();
      //console.log('lottery:', lottery);
      return lottery;
    } catch (error) {
      console.error("Error fetching latest lottery:", error);
      return null;
    }
  }

  // 获取所有到期未开奖的抽奖活动
  public async getPendingLotteries(chatId: number, now: string): Promise<ILottery[]> {
    return await LotteryModel.find({
      chatId,
      endTime: { $lte: new Date(now) },
      isDrawn: false,
    }).exec();
  }


  public static async generateInviteLink(userId: number, botName: string): Promise<string> {
    // 参数验证
    if (typeof userId !== 'number' || userId <= 0) {
        throw new Error('无效的用户ID');
    }
    if (typeof botName !== 'string' || botName.trim() === '') {
        throw new Error('无效的机器人名称');
    }

    // 查找用户
    const user = await UserModel.findOne({ uid: userId });
    if (!user) {
        console.log('用户未找到');
        throw new Error('用户未找到');
    }

    // 检查是否已有邀请链接
    if (user.inviteLink && user.inviteLink.length > 0) {
        return user.inviteLink;
    }

    // 生成邀请链接
    const payload = `${userId}`;
    const inviteLink = `https://t.me/${botName}?start=${Buffer.from(payload).toString('base64').replace(/=/g, '')}`;

    // 更新用户的邀请链接
    user.inviteLink = inviteLink;
    await user.save();

    console.log('生成的邀请链接:', inviteLink);
    return inviteLink;
}


  public static async recordInvite(inviterId: number, inviteeId: number): Promise<void> {
    const invite = new InviteModel({ inviterId, inviteeId });
    await invite.save();

    const inviter = await UserModel.findOne({ uid: inviterId });
    if (inviter) {
      inviter.invites = (inviter.invites || 0) + 1;
      inviter.invitePoints += 15; // 每次邀请加15分
      await inviter.save();
    }
  }


  async saveOAuthToken(userId: number, oauthToken: string): Promise<void> {
    try {
      await OAuthTokenModel.create({ userId, oauthToken });
    } catch (error) {
      console.error("Error saving OAuth token:", error);
      throw error;
    }
  }

  async getOAuthToken(userId: number): Promise<string | null> {
    try {
      const token = await OAuthTokenModel.findOne({ userId });
      return token ? token.oauthToken : null;
    } catch (error) {
      console.error("Error fetching OAuth token:", error);
      throw error;
    }
  }

  static async updateUserPoints(uid: number, points: number): Promise<User | null> {
    try {
      // 先获取当前用户信息
      const user = await UserModel.findOne({ uid });
      
      // 如果用户不存在，创建新用户
      if (!user) {
        // return await UserModel.create({
        //   uid,
        //   points,
        //   messagesSent: points, // 新用户的 messagesSent 设置为 points
        //   firstName: 'Unknown' // 必需字段，设置默认值
        // });
        console.log("用户未找到:", uid);
        return null
      }

      // 如果当前的 messagesSent 小于新的 points，更新 messagesSent
      const updateData: { points: number; messagesSent?: number } = { points };
      if (user.messagesSent < points) {
        updateData.messagesSent = points;
        updateData.points = points;
      }
      
      console.log("updateData messagesSent:", updateData.messagesSent, "points:", updateData.points);
      // 更新用户数据
      const updatedUser = await UserModel.findOneAndUpdate(
        { uid },
        { $set: updateData },
        { new: true }
      );
      return updatedUser;
      
    } catch (error) {
      console.error("Error updating user points:", error);
      throw error;
    }
  }

}
