import express from 'express';
import Announcement from '../Models/Announcement.js';
import { protect, adminOnly } from '../Middelware/authMiddleware.js';

const router = express.Router();

// @desc    Get all active announcements
// @route   GET /api/announcements
router.get('/', protect, async (req, res, next) => {
    try {
        const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: -1 });
        res.json({ success: true, announcements });
    } catch (error) {
        next(error);
    }
});

// @desc    Create an announcement (Admin Only)
// @route   POST /api/announcements
router.post('/', protect, adminOnly, async (req, res, next) => {
    try {
        const { content, priority } = req.body;
        const announcement = await Announcement.create({
            content,
            priority: priority || 'Info',
            author: req.user._id
        });
        res.status(201).json({ success: true, announcement });
    } catch (error) {
        next(error);
    }
});

// @desc    Toggle announcement status (Admin Only)
// @route   PATCH /api/announcements/:id/toggle
router.patch('/:id/toggle', protect, adminOnly, async (req, res, next) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            res.status(404);
            throw new Error('Announcement not found');
        }
        announcement.isActive = !announcement.isActive;
        await announcement.save();
        res.json({ success: true, announcement });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete announcement (Admin Only)
// @route   DELETE /api/announcements/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            res.status(404);
            throw new Error('Announcement not found');
        }
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
        next(error);
    }
});

export default router;
