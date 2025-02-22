"use strict";
// config.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.default = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    mongodbConnectionString: process.env.MONGODB_CONNECTION_STRING || "",
    // 添加其他配置项...
};
