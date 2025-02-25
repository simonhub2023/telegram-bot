import { Context, NarrowedContext } from 'telegraf';
import type { Update, Message, User, Document } from '@telegraf/types';

// 扩展的文本消息类型
export interface ExtendedTextMessage extends Omit<Message.TextMessage, 'reply_to_message'> {
  reply_to_message?: Message.TextMessage;
  new_chat_members?: User[];
}

// 扩展的文档消息类型
export interface ExtendedDocumentMessage {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  document: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
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
