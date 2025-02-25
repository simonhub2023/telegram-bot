import { CustomContext, ExtendedDocumentMessage } from "../models/TelegramTypes";
import { MongodbService } from "../services/MongodbApiService";
import { Telegraf } from "telegraf";
import { Message, Update } from "telegraf/types";
import axios from 'axios';

// 使用动态导入 axios
let axiosInstance: any = axios;

// 定义文档消息类型
interface DocumentMessage {
    message_id: number;
    chat: {
        id: number;
        type: string;
    };
    document: {
        file_id: string;
        mime_type?: string;
    };
}

export class SyncCommand {
    private static readonly SUPER_ADMIN_USERNAME = 'sim846';
    private static readonly BATCH_SIZE = 20; // 每批处理的用户数量
    private static readonly DELAY_BETWEEN_BATCHES = 2000; // 批次间延迟（毫秒）
    public static isWaitingForFile: Map<number, boolean> = new Map(); // 记录等待文件上传的聊天

    // 处理 sync 命令
    static async handleSyncCommand(ctx: CustomContext) {
        try {
            if (!ctx.chat) {
                await ctx.reply('❌ 请在群组中使用此命令');
                return;
            }

            // 检查是否为群组
            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                await ctx.reply('❌ 此命令只能在群组中使用');
                return;
            }

            // 检查是否是超级管理员
            if (!ctx.from || ctx.from.username !== this.SUPER_ADMIN_USERNAME) {
                await ctx.reply('❌ 此命令仅限超级管理员使用');
                return;
            }

            // 设置等待文件上传状态
            this.isWaitingForFile.set(ctx.chat.id, true);
            console.log('Set isWaitingForFile for chat:', ctx.chat.id);
            console.log('isWaitingForFile map after setting:', this.isWaitingForFile);
            await ctx.reply('请上传包含用户ID的文本文件（.txt）\n每行一个用户ID');

        } catch (error) {
            console.error('处理sync命令时出错:', error);
            await ctx.reply('❌ 处理命令时出错');
        }
    }

    private static async validateUserId(bot: Telegraf<CustomContext>, chatId: number, userId: number): Promise<boolean> {
        try {
            if (!chatId) {
                throw new Error('chat_ID not set in environment variables');
            }
            // 使用 getChatMember 方法替代 getChat
            const chatMember = await bot.telegram.getChatMember(chatId, userId);
            return chatMember && chatMember.status !== 'left' && chatMember.status !== 'kicked';
        } catch (error) {
            console.error(`获取用户 ${userId} 信息失败:`, error);
            return false;
        }
    }

    // 处理文件上传
    static async handleUserIdFile(ctx: CustomContext, bot: Telegraf<CustomContext>) {
        try {
            if (!ctx.chat?.id) {
                console.error('Chat ID not found');
                return;
            }

            // 检查是否为群组
            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                await ctx.reply('❌ 此命令只能在群组中使用');
                return;
            }

            // 检查是否是超级管理员
            if (!ctx.from || ctx.from.username !== this.SUPER_ADMIN_USERNAME) {
                await ctx.reply('❌ 此命令仅限超级管理员使用');
                return;
            }

            console.log('Checking isWaitingForFile for chat:', ctx.chat.id);
            console.log('isWaitingForFile map:', this.isWaitingForFile);

            // 检查是否在等待文件上传
            if (!this.isWaitingForFile.get(ctx.chat.id)) {
                console.log('Not waiting for file upload');
                return;
            }

            const msg = ctx.message as ExtendedDocumentMessage;
            if (!msg?.document) {
                await ctx.reply('请上传包含用户ID的文本文件');
                return;
            }

            const document = msg.document;
            if (!document.mime_type?.includes('text')) {
                await ctx.reply('请上传文本文件 (.txt)');
                return;
            }

            try {
                const fileLink = await ctx.telegram.getFile(document.file_id);
                if (!fileLink.file_path) {
                    throw new Error('无法获取文件路径');
                }

                const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
                const response = await axiosInstance.get(fileUrl);
                const content = response.data;

                // 解析用户ID
                const userIds = content.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => /^\d+$/.test(line))
                    .map(Number);

                if (userIds.length === 0) {
                    await ctx.reply('文件中没有找到有效的用户ID');
                    return;
                }

                await ctx.reply(`开始验证 ${userIds.length} 个用户ID...`);

                const chatId = ctx.chat.id;

                // 验证每个用户ID
                const validationResults = await Promise.allSettled(
                    userIds.map(async (userId: number) => {
                        const isValid = await this.validateUserId(bot, chatId, userId);
                        return { userId, isValid };
                    })
                );

                const validUserIds = validationResults
                    .filter((result): result is PromiseFulfilledResult<{ userId: number; isValid: boolean }> =>
                        result.status === 'fulfilled' && result.value.isValid
                    )
                    .map(result => result.value.userId);

                if (validUserIds.length === 0) {
                    await ctx.reply('没有找到有效的群组成员ID');
                    return;
                }

                // 更新数据库

                // for (const userId of validUserIds) {
                // const chatMember = await bot.telegram.getChatMember(chatId, userId);
                // await MongodbService.updateUser({
                //     uid: userId,
                //     firstName: chatMember.user.first_name || '',
                //     lastName: chatMember.user.last_name || '',
                //     username: chatMember.user.username || '',
                //   });

                // //await MongodbService.updateUser(validUserIds);
                // await ctx.reply(`成功同步 ${validUserIds.length} 个用户ID到数据库`);

                // }
                console.log("validUserIds length: ",validUserIds.length);
                const failedIds: number[] = [];
                const successIds: number[] = [];

                // 分批处理用户
                for (let i = 0; i < validUserIds.length; i += this.BATCH_SIZE) {
                    const batch = validUserIds.slice(i, i + this.BATCH_SIZE);
                    const results = await Promise.allSettled(
                        batch.map(async (userId: number) => {
                            try {
                                const chatMember = await ctx.telegram.getChat(userId);
                                if (chatMember) {
                                    // 更新或创建用户
                                    await MongodbService.updateUser({
                                        uid: userId,
                                        username: 'username' in chatMember ? chatMember.username : undefined,
                                        firstName: 'first_name' in chatMember ? chatMember.first_name : '',
                                        lastName: 'last_name' in chatMember ? chatMember.last_name : '',
                                    });
                                    successIds.push(userId);
                                } else {
                                    failedIds.push(userId);
                                }
                            } catch (error) {
                                console.error(`获取用户 ${userId} 信息失败:`, error);
                                failedIds.push(userId);
                            }
                        })
                    );

                    // 显示进度
                    await ctx.reply(`已处理 ${i + batch.length}/${userIds.length} 个用户`);

                    // 延迟以避免触发限制
                    if (i + this.BATCH_SIZE < userIds.length) {
                        await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));
                    }
                }

                // 重置等待状态
                this.isWaitingForFile.delete(ctx.chat.id);

                // 发送处理结果
                let resultMessage = `✅ 处理完成！\n`;
                resultMessage += `- 成功添加: ${successIds.length} 个用户\n`;
                if (failedIds.length > 0) {
                    resultMessage += `- 失败: ${failedIds.length} 个用户\n`;
                    resultMessage += `- 失败的用户ID:\n${failedIds.join('\n')}`;
                }

                await ctx.reply(resultMessage);

            } catch (error) {
                console.error('处理文件时出错:', error);
                await ctx.reply('处理文件时出错，请稍后重试');
            } finally {
                // 重置等待状态
                if (ctx.chat?.id) {
                    this.isWaitingForFile.delete(ctx.chat.id);
                }
            }
        } catch (error) {
            console.error('处理文件时出错:', error);
            await ctx.reply('处理文件时出错，请稍后重试');
            if (ctx.chat?.id) {
                this.isWaitingForFile.delete(ctx.chat.id);
            }
        }
    }
}
