import { redis } from "./redisClient.js";

export async function withCache(key, ttleSeconds, fetchFn) {
    const cached = await redis.get(key);
    if (cached) {
        console.log(`cache hit: ${key}`);
        return JSON.parse(cached);
    }

    const fresh = await fetchFn();

    redis.setEx(
        key,
        ttleSeconds,
        JSON.stringify(fresh)
    );

    return fresh;
}