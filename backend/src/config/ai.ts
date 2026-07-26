import { env } from '#root/utils/env.js';

export const aiConfig = {
    serverIP: env('AI_SERVER_IP') || 'localhost',
    serverPort: env('AI_SERVER_PORT') || 9017,
    proxyAddress: env('AI_PROXY_ADDRESS') || 'socks5h://localhost:1055',
    GEMINI_API_KEY: env('GEMINI_API_KEY') || null,
    GEMINI_MODEL: env('GEMINI_MODEL') || 'gemini-2.5-flash'
};
