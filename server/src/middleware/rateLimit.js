import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redisClient.js";

export const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limited" },
    store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args)
    }),
});