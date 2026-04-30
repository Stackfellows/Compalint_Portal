import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for guest chat
    messages: [{
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    sessionId: String,
    status: { type: String, default: 'active' }
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);
export default Chat;
