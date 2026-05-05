import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
    priority: { type: String, enum: ['Info', 'Warning', 'Important'], default: 'Info' }
}, { timestamps: true });

export default mongoose.model('Announcement', announcementSchema);
