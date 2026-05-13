import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';

import connectDB from './DB/db.js';
import { initSocket } from './Utils/socket.js';
import { globalLimiter } from './Middelware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './Middelware/errorHandler.js';
import authRoutes from './Routes/authRoutes.js';
import complaintRoutes from './Routes/complaintRoutes.js';
import adminRoutes from './Routes/adminRoutes.js';
import chatRoutes from './Routes/chatRoutes.js';
import userRoutes from './Routes/userRoutes.js';
import managerRoutes from './Routes/managerRoutes.js';
import announcementRoutes from './Routes/announcementRoutes.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();

// 1. Connect to Database (Optimized for high connections)
connectDB();

// 2. High-Performance Security & Logging Middleware
app.use(helmet()); // Protects against known web vulnerabilities by setting HTTP headers
app.use(compression()); // Compresses JSON payloads to save bandwidth (crucial for 40k users)
app.use(morgan('dev')); // Logs requests efficiently

// Flexible CORS Policy for Production and Development
const allowedOrigins = [
    'https://hunarmand.punjab.gov.pk',
    'https://complaint.hunarmandpunjab.org.pk',
    'https://www.complaint.hunarmandpunjab.org.pk',
    'https://complaint.stackfellows.com',
    'https://complaint-portal-frontend.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Remove trailing slash for comparison
        const normalizedOrigin = origin.replace(/\/$/, "");
        const isAllowed = allowedOrigins.some(allowed => allowed.replace(/\/$/, "") === normalizedOrigin);

        if (isAllowed || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '1mb' })); // Limit JSON payload size to prevent memory overload
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 3. Deep Security: Data Leak & Injection Prevention
app.use(mongoSanitize()); // Prevents NoSQL Injection (stops attackers from bypassing logins using $gt or $ne operators)
app.use(xss()); // Prevents Cross-Site Scripting (XSS) by stripping dangerous HTML tags from user inputs
app.use(hpp()); // Prevents HTTP Parameter Pollution (stops attackers from crashing server by sending multiple identical parameters)

// 4. Rate Limiting to prevent DDoS
app.use(globalLimiter);

// 5. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/announcements', announcementRoutes);

app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Complaint Portal Backend Server is Running!',
        status: 'Healthy',
        activeConnections: 'Protected by Helmet, Compression & Rate-Limiting'
    });
});

// 6. Error Handling Middleware (Catches unhandled errors so server doesn't crash)
app.use(notFoundHandler);
app.use(errorHandler);

// 6. Start Server with Graceful Shutdown Handling
const PORT = process.env.PORT || 3200;

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Secure Enterprise Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log('✅ Health Check: http://localhost:' + PORT);
});

// Initialize Socket.io
initSocket(server);

// Handle Unhandled Rejections
process.on('unhandledRejection', (err) => {
    console.error('💥 UNHANDLED REJECTION! Shutting down...');
    console.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

// Graceful Shutdown - ensures current requests finish before killing the process
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('💤 Process terminated.');
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('💤 Closed out remaining connections.');
        process.exit(0);
    });
});
