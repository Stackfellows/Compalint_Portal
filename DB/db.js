import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
    try {
        // High Concurrency Tuning for 40,000+ users
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 200, // Maintain up to 200 socket connections
            serverSelectionTimeoutMS: 15000, // Wait 15 seconds to connect before failing
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        });
        console.log(`✅ MongoDB Connected (High Concurrency Pool): ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

// Handle unexpected MongoDB disconnections gracefully
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected successfully.');
});

export default connectDB;
