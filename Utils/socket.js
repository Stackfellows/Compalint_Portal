import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust in production
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        socket.on('join', (userId) => {
            socket.join(userId);
            console.log(`👤 User ${userId} joined their notification room`);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected');
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

// Helper to notify a specific user
export const notifyUser = (userId, type, message, data = {}) => {
    if (io) {
        io.to(userId).emit('notification', { type, message, data });
    }
};

// Helper to notify all admins/staff
export const notifyStaff = (type, message, data = {}) => {
    if (io) {
        // We can emit to a specific role room if implemented, 
        // for now just broadcast or you can add role-based rooms in 'join'
        io.emit('staff_notification', { type, message, data });
    }
};
