import rateLimit from 'express-rate-limit';

// Global Limiter: Prevents general DDoS attacks (Max 500 requests per 10 minutes per IP)
export const globalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 500, 
    message: { error: 'Too many requests from this IP, please try again after 10 minutes' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// Strict API Limiter: Specifically for high-load routes like Login/Create Complaint (Max 20 requests per minute)
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20,
    message: { error: 'Too many API requests, please slow down' },
});
