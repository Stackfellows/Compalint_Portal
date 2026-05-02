import express from 'express';
import mongoose from 'mongoose';
import Complaint from '../Models/Complaint.js';
import Department from '../Models/Department.js';
import { protect, staffOrAdmin } from '../Middelware/authMiddleware.js';
import { notifyStaff, notifyUser } from '../Utils/socket.js';

const router = express.Router();

// Generate unique Complaint ID: HP-DEP-2026-0001
const generateComplaintId = async (department) => {
    const date = new Date();
    const year = date.getFullYear();
    const deptCode = department.substring(0, 3).toUpperCase();
    
    // Find the count of complaints for this year to increment the sequence
    const count = await Complaint.countDocuments({
        complaintId: new RegExp(`HP-${deptCode}-${year}-`)
    });
    
    const sequence = (count + 1).toString().padStart(4, '0');
    return `HP-${deptCode}-${year}-${sequence}`;
};

import { upload, uploadToCloudinary } from '../Utils/cloudinary.js';

// @desc    Create new complaint
// @route   POST /api/complaints
router.post('/', protect, upload.array('attachments', 5), async (req, res, next) => {
    try {
        const { department, subDepartment, subject, description, priority } = req.body;

        if (!department || !subDepartment || !subject || !description) {
            res.status(400);
            throw new Error('Please provide all required fields');
        }

        const complaintId = await generateComplaintId(department);

        // Modern: Manual Cloudinary Upload from memory
        const attachments = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'complaints', file.originalname));
            const uploadResults = await Promise.all(uploadPromises);
            
            uploadResults.forEach((result, index) => {
                attachments.push({
                    url: result.secure_url,
                    publicId: result.public_id,
                    name: req.files[index].originalname
                });
            });
        }

        const complaint = await Complaint.create({
            complaintId,
            user: req.user._id,
            department,
            subDepartment,
            subject,
            description,
            priority: priority || 'Medium',
            attachments
        });

        // Notify Staff/Admin about new complaint
        notifyStaff('new_complaint', `New Complaint: ${subject}`, { complaintId: complaint._id });

        res.status(201).json({
            success: true,
            complaint
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get all complaints
// @route   GET /api/complaints
router.get('/', protect, async (req, res, next) => {
    try {
        let query = {};

        // If user is a student, only show their complaints
        if (req.user.role === 'student') {
            query.user = req.user._id;
        } 
        
        // If staff, show complaints for their department
        if (req.user.role === 'staff') {
            query.department = req.user.department;
        }

        const complaints = await Complaint.find(query)
            .populate('user', 'name email role cnic rollNo')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: complaints.length,
            complaints
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get all active departments
// @route   GET /api/complaints/departments
router.get('/departments', protect, async (req, res, next) => {
    try {
        const departments = await Department.find({});
        console.log(`📡 Sending ${departments.length} departments to Student`);
        res.json({
            success: true,
            departments
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get single complaint
// @route   GET /api/complaints/:id
router.get('/:id', protect, async (req, res, next) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('user', 'name email role cnic phone rollNo')
            .populate('messages.sender', 'name role');

        if (!complaint) {
            res.status(404);
            throw new Error('Complaint not found');
        }

        // Authorization check: students can only see their own
        if (req.user.role === 'student' && complaint.user._id.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error('Not authorized to view this complaint');
        }

        res.json({
            success: true,
            complaint
        });
    } catch (error) {
        next(error);
    }
});
// @desc    Update complaint status
// @route   PUT /api/complaints/:id/status
router.put('/:id/status', protect, staffOrAdmin, async (req, res, next) => {
    try {
        const { status } = req.body;
        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            res.status(404);
            throw new Error('Complaint not found');
        }

        complaint.status = status;
        
        // Automatically assign the ticket to the staff/admin who is handling it
        // Only if they have a valid MongoDB ObjectId (skips hardcoded admin string IDs)
        if (mongoose.Types.ObjectId.isValid(req.user._id)) {
            complaint.assignedTo = req.user._id;
        }

        await complaint.save();

        res.json({
            success: true,
            complaint
        });
    } catch (error) {
        console.error('Status Update Error:', error.message);
        next(error);
    }
});

// @desc    Add message to complaint
// @route   POST /api/complaints/:id/messages
router.post('/:id/messages', protect, upload.array('attachments', 5), async (req, res, next) => {
    try {
        const { content } = req.body;
        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            res.status(404);
            throw new Error('Complaint not found');
        }

        // Authorization check
        if (req.user.role === 'student') {
            if (complaint.user.toString() !== req.user._id.toString()) {
                res.status(403);
                throw new Error('Not authorized to message on this complaint');
            }
            
            if (complaint.status === 'Closed') {
                res.status(400);
                throw new Error('This complaint is closed. Please create a new complaint for further assistance.');
            }
        }

        // Modern: Manual Cloudinary Upload from memory for Chat
        const attachments = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'chat_attachments', file.originalname));
            const uploadResults = await Promise.all(uploadPromises);
            
            uploadResults.forEach((result, index) => {
                attachments.push({
                    url: result.secure_url,
                    publicId: result.public_id,
                    name: req.files[index].originalname
                });
            });
        }

        const newMessage = {
            sender: req.user._id,
            content: content || (attachments.length > 0 ? "Sent an attachment" : ""),
            attachments: attachments,
            timestamp: new Date()
        };

        complaint.messages.push(newMessage);
        await complaint.save();

        // Notify the other party
        if (req.user.role === 'student') {
            // Student messaged, notify staff (simplified as global staff notify for now)
            notifyStaff('new_message', `New message on ${complaint.complaintId}`, { complaintId: complaint._id });
        } else {
            // Staff/Admin messaged, notify the student
            notifyUser(complaint.user.toString(), 'new_message', `Staff replied to your complaint ${complaint.complaintId}`, { complaintId: complaint._id });
        }

        res.status(201).json({
            success: true,
            message: newMessage
        });
    } catch (error) {
        next(error);
    }
});

export default router;
