import mongoose, { Schema, model, Document, Types } from 'mongoose';

// 用户模型
export interface User extends Document {
  uid: number;
  firstName: string;
  lastName?: string;
  username?: string;
  x_uername?: string;
  twitterAccessToken?: string;
  twitterAccessSecret? : string;
  points: number;
  messagesSent: number;
  invitePoints: number;
  twitterPoints: number;
  meetingPoints: number;
  lotteryPoints: number;
  donatePoints: number;
  specialPoints: number;
  dailyPoints: number;
  invites: number;
  lastUpdated: Date;
  lastSubmited: Date;
  joinedAt: Date;
  notifiedForLottery: boolean; // 添加这个字段
  inviteLink: string; // 添加 inviteLink 字段
}

const UserSchema = new Schema<User>({
  uid: { type: Number, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: String,
  username: String,
  x_uername: String,
  twitterAccessToken: String,
  twitterAccessSecret: String,
  points: { type: Number, default: 0 },
  messagesSent: { type: Number, default: 0 },// 发送消息数
  invitePoints: { type: Number, default: 0 },// 邀请积分
  twitterPoints: { type: Number, default: 0 },// 推特积分
  meetingPoints: { type: Number, default: 0 },// 会议积分
  lotteryPoints: { type: Number, default: 0 },// 抽奖积分
  donatePoints: { type: Number, default: 0 },// 捐赠积分
  specialPoints: { type: Number, default: 0 },// 特殊积分
  dailyPoints: { type: Number, default: 0 },  // 每日积分
  invites: { type: Number, default: 0 },// 邀请人数
  lastUpdated: { type: Date, default: Date.now },  // 上次更新时间
  lastSubmited: { type: Date, default: Date.now },  // 上次更新时间
  joinedAt: { type: Date, default: Date.now },
  notifiedForLottery: { type: Boolean, required: true, default: false }, // 添加这个字段
  inviteLink: String, // 添加 inviteLink 字段
});

export const UserModel = model<User>('User', UserSchema);

// 参与者接口
export interface IParticipant {
  userId: number;
  messageCount: number;
}
// 纯数据接口（不包含 Mongoose 方法）
export interface ILottery {
  //lotteryId: number;
  //_id: mongoose.Types.ObjectId; // 添加 _id 属性
  lotteryId: string; // 添加 lotteryId 属性
  chatId: number;
  prize: string;
  participants: IParticipant[];
  winners: number[];
  createTime: Date;
  endTime: Date;
  isDrawn: boolean; // 添加这个字段
 
}


// 模型 Schema
const LotterySchema = new Schema<ILottery>({
  //lotteryId:{ type: Number, required: true, unique: true },
  //_id: { type: Schema.Types.ObjectId, required: true }, // 添加 _id 字段
  lotteryId: { type: String, unique: true, required: true }, // 添加 lotteryId 字段
  chatId: { type: Number, required: true },
  prize: { type: String, required: true },
  participants: [{
    userId: { type: Number, required: true },
    messageCount: { type: Number, required: true }
  }],
  winners: [Number],
  createTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isDrawn: { type: Boolean, required: true, default: false }, // 添加这个字段
  
});

export interface OAuthToken extends Document {
  userId: number;
  oauthToken: string;
  twitterAuthState?: string;
}

export interface IInvite extends Document {
  inviterId: number;
  inviteeId: number;
  inviteDate: Date;
}

const InviteSchema: Schema = new Schema({
  inviterId: { type: Number, required: true },// 邀请者ID
  inviteeId: { type: Number, required: true },// 被邀请者ID
  inviteDate: { type: Date, required: true, default: Date.now },// 邀请日期
});

const OAuthTokenSchema: Schema = new Schema({
  userId: { type: Number, required: true, unique: true },
  oauthToken: { type: String, required: true },
  twitterAuthState: String,
});

export const LotteryModel = model<ILottery>('Lottery', LotterySchema);
export const InviteModel = mongoose.model<IInvite>('Invite', InviteSchema);
export const OAuthTokenModel = mongoose.model<OAuthToken>('OAuthToken', OAuthTokenSchema);
