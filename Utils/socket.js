import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust in production
            methods: ["GET", "POST"]
        }
    });
    const ticketViews = new Map(); // Store views: ticketId -> Map<socketId, { _id, name }>
    
    io.on('connection', (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        socket.on('join', (userId) => {
            socket.join(userId);
            console.log(`👤 User ${userId} joined their notification room`);
        });

        // Ticket presence logic
        socket.on('view_ticket', ({ ticketId, user }) => {
            if (!ticketId || !user) return;
            
            socket.join(`ticket_${ticketId}`);
            socket.data.ticketId = ticketId;
            socket.data.user = user;
            
            if (!ticketViews.has(ticketId)) {
                ticketViews.set(ticketId, new Map());
            }
            // Add user to this ticket's views
            ticketViews.get(ticketId).set(socket.id, user);

            // Broadcast the updated list of viewers for this ticket to everyone
            io.emit('ticket_viewers_update', { 
                ticketId, 
                viewers: Array.from(ticketViews.get(ticketId).values()) 
            });
        });

        socket.on('leave_ticket', ({ ticketId }) => {
            if (!ticketId) return;
            socket.leave(`ticket_${ticketId}`);
            
            if (ticketViews.has(ticketId)) {
                ticketViews.get(ticketId).delete(socket.id);
                // Clean up empty maps
                if (ticketViews.get(ticketId).size === 0) {
                    ticketViews.delete(ticketId);
                    io.emit('ticket_viewers_update', { ticketId, viewers: [] });
                } else {
                    io.emit('ticket_viewers_update', { 
                        ticketId, 
                        viewers: Array.from(ticketViews.get(ticketId).values()) 
                    });
                }
            }
            socket.data.ticketId = null;
        });

        socket.on('request_active_views', () => {
            // Send current views for all tickets to the requesting client
            const allViews = {};
            for (const [tId, viewsMap] of ticketViews.entries()) {
                const viewers = Array.from(viewsMap.values());
                if (viewers.length > 0) {
                    allViews[tId] = viewers;
                }
            }
            socket.emit('active_views_sync', allViews);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected');
            const ticketId = socket.data.ticketId;
            if (ticketId && ticketViews.has(ticketId)) {
                ticketViews.get(ticketId).delete(socket.id);
                if (ticketViews.get(ticketId).size === 0) {
                    ticketViews.delete(ticketId);
                    io.emit('ticket_viewers_update', { ticketId, viewers: [] });
                } else {
                    io.emit('ticket_viewers_update', { 
                        ticketId, 
                        viewers: Array.from(ticketViews.get(ticketId).values()) 
                    });
                }
            }
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
