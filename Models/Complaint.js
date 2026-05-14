import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: [{
        url: String,
        publicId: String,
        name: String
    }],
    timestamp: { type: Date, default: Date.now }
});

const complaintSchema = new mongoose.Schema({
    complaintId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String, required: true },
    subDepartment: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Open', 'Review', 'In Progress', 'Resolved', 'Closed'], 
        default: 'Open' 
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    attachments: [{
        url: String,
        publicId: String,
        name: String
    }],
    messages: [messageSchema],
    internalNotes: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        timestamp: { type: Date, default: Date.now }
    }],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String },
}, { timestamps: true });

export default mongoose.model('Complaint', complaintSchema);
