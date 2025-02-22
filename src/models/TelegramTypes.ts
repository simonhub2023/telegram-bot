import { Context, NarrowedContext } from 'telegraf';
import type { Update, Message, User } from '@telegraf/types';

// 扩展的文本消息类型
export interface ExtendedTextMessage extends Omit<Message.TextMessage, 'reply_to_message'> {
  reply_to_message?: Message.TextMessage;
  new_chat_members?: User[];
}

export interface CustomContext extends Context {
  userData?: any; // 可扩展自定义数据
  startPayload?: string; // 添加 startPayload 属性
}

export interface PaginationConfig {
  pageSize?: number;
  maxPageButtons?: number;
}

export interface RankUser {
  uid: number;
  username?: string;
  firstName: string;
  lastName?: string;
  [key: string]: any;
}
