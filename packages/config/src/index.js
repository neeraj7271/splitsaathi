"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.loadEnv = loadEnv;
const zod_1 = require("zod");
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    DATABASE_URL: zod_1.z.string().min(1),
    TEST_DATABASE_URL: zod_1.z.string().min(1).optional(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16),
    OTP_DEV_CODE: zod_1.z.string().regex(/^\d{6}$/).default('123456'),
    APP_PUBLIC_URL: zod_1.z.string().url().default('http://localhost:3000'),
    MOBILE_API_URL: zod_1.z.string().url().default('http://localhost:3000')
});
function loadEnv(source = process.env) {
    return exports.envSchema.parse(source);
}
//# sourceMappingURL=index.js.map