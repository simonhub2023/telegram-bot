import { CustomContext, ExtendedDocumentMessage } from "../models/TelegramTypes";
import { MongodbService } from "../services/MongodbApiService";
import { Telegraf } from "telegraf";
import axios from 'axios';
import * as XLSX from 'xlsx';
import { UserModel } from "../models/DatabaseModels";

// 使用动态导入 axios
let axiosInstance: any = axios;

// 定义Excel行数据接口
interface ScoreRow {
    uid: string | number;
    score: string | number;
    [key: string]: any; // 允许其他字段存在
}

export class ImportScoreCommand {
    private static readonly SUPER_ADMIN_USERNAME = 'sim846';
    public static isWaitingForFile: Map<number, boolean> = new Map();

    // 处理 import_score 命令
    static async handleImportScoreCommand(ctx: CustomContext) {
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
            await ctx.reply('请上传包含用户积分的Excel文件\n格式：uid, score');

        } catch (error) {
            console.error('处理import_score命令时出错:', error);
            await ctx.reply('❌ 处理命令时出错');
        }
    }

    // 处理Excel文件上传
    static async handleScoreFile(ctx: CustomContext) {
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

            // 检查是否在等待文件上传
            if (!this.isWaitingForFile.get(ctx.chat.id)) {
                return;
            }

            const msg = ctx.message as ExtendedDocumentMessage;
            if (!msg?.document) {
                await ctx.reply('请上传Excel文件');
                return;
            }

            // 检查文件类型
            const validMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                'application/vnd.ms-excel', // .xls
            ];
            
            if (!msg.document.mime_type || !validMimeTypes.includes(msg.document.mime_type)) {
                await ctx.reply('请上传Excel文件 (.xlsx 或 .xls)');
                return;
            }

            try {
                const fileLink = await ctx.telegram.getFile(msg.document.file_id);
                if (!fileLink.file_path) {
                    throw new Error('无法获取文件路径');
                }

                const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
                const response = await axiosInstance.get(fileUrl, { responseType: 'arraybuffer' });
                const workbook = XLSX.read(response.data, { type: 'buffer' });

                // 获取第一个工作表
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json<ScoreRow>(worksheet);

                if (data.length === 0) {
                    await ctx.reply('Excel文件中没有找到数据');
                    return;
                }

                let successCount = 0;
                let failedCount = 0;
                const errors: string[] = [];

                // 处理每一行数据
                for (const row of data) {
                    try {
                        const uid = Number(row.uid);
                        const score = Number(row.score);

                        if (isNaN(uid) || isNaN(score)) {
                            errors.push(`无效的数据格式: uid=${row.uid}, score=${row.score}`);
                            failedCount++;
                            continue;
                        }

                        // 更新用户积分
                        const updatedUser = await MongodbService.updateUserPoints(uid, score);
                        if (updatedUser) {
                            console.log(`✅ 用户 ${uid} 更新成功:`);
                            console.log(`  - 积分: ${score}`);
                            console.log(`  - 发言数: ${updatedUser.messagesSent}`);
                            if (updatedUser.messagesSent === score) {
                                console.log(`  - 发言数已同步更新为 ${score}`);
                            }
                        }
                        successCount++;
                    } catch (error) {
                        console.error('更新用户积分失败:', error);
                        errors.push(`更新失败: uid=${row.uid}`);
                        failedCount++;
                    }
                }

                // 生成结果报告
                let report = `处理完成!\n成功: ${successCount}\n失败: ${failedCount}`;
                if (errors.length > 0) {
                    report += '\n\n错误详情 (最多显示5个):\n' + errors.slice(0, 5).join('\n');
                }

                await ctx.reply(report);

            } catch (error) {
                console.error('处理Excel文件时出错:', error);
                await ctx.reply('❌ 处理Excel文件时出错');
            } finally {
                // 清除等待状态
                this.isWaitingForFile.delete(ctx.chat.id);
            }

        } catch (error) {
            console.error('处理文件上传时出错:', error);
            await ctx.reply('❌ 处理文件时出错');
        }
    }
}
