import express from 'express';
import User from '../Models/User.js';
import Complaint from '../Models/Complaint.js';
import { protect, managerOnly } from '../Middelware/authMiddleware.js';

const router = express.Router();

// @desc    Manager Dashboard - Overview Stats
// @route   GET /api/manager/stats
router.get('/stats', protect, managerOnly, async (req, res, next) => {
    try {
        const { filter = 'all' } = req.query;
        let query = {};

        if (filter !== 'all') {
            const now = new Date();
            let startDate = new Date();
            if (filter === 'daily') startDate.setHours(now.getHours() - 24);
            else if (filter === 'weekly') startDate.setDate(now.getDate() - 7);
            else if (filter === 'monthly') startDate.setMonth(now.getMonth() - 1);
            else if (filter === 'yearly') startDate.setFullYear(now.getFullYear() - 1);
            query.createdAt = { $gte: startDate };
        }

        const totalComplaints   = await Complaint.countDocuments(query);
        const openComplaints    = await Complaint.countDocuments({ ...query, status: 'Open' });
        const inProgress        = await Complaint.countDocuments({ ...query, status: 'In Progress' });
        const underReview       = await Complaint.countDocuments({ ...query, status: 'Review' });
        const resolved          = await Complaint.countDocuments({ ...query, status: { $in: ['Resolved', 'Closed'] } });
        const totalStaff        = await User.countDocuments({ role: 'staff' });
        const activeStaff       = await User.countDocuments({ role: 'staff', status: 'Active' });

        const efficiencyRate = totalComplaints > 0
            ? Math.round((resolved / totalComplaints) * 100)
            : 0;

        // Today's activity
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const newToday = await Complaint.countDocuments({ createdAt: { $gte: todayStart } });
        const resolvedToday = await Complaint.countDocuments({
            updatedAt: { $gte: todayStart },
            status: { $in: ['Resolved', 'Closed'] }
        });

        res.json({
            success: true,
            stats: {
                total: totalComplaints,
                open: openComplaints,
                inProgress,
                underReview,
                resolved,
                totalStaff,
                activeStaff,
                efficiencyRate,
                newToday,
                resolvedToday,
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get each staff member's performance details
// @route   GET /api/manager/team-performance
router.get('/team-performance', protect, managerOnly, async (req, res, next) => {
    try {
        const { filter = 'all' } = req.query;
        let query = {};

        if (filter !== 'all') {
            const now = new Date();
            let startDate = new Date();
            if (filter === 'daily') startDate.setHours(now.getHours() - 24);
            else if (filter === 'weekly') startDate.setDate(now.getDate() - 7);
            else if (filter === 'monthly') startDate.setMonth(now.getMonth() - 1);
            else if (filter === 'yearly') startDate.setFullYear(now.getFullYear() - 1);
            query.createdAt = { $gte: startDate };
        }

        const staffMembers = await User.find({ role: 'staff' }).select('-password').lean();

        const teamData = await Promise.all(staffMembers.map(async (staff) => {
            // Tickets directly assigned to them
            const assigned    = await Complaint.countDocuments({ ...query, assignedTo: staff._id });
            const resolved    = await Complaint.countDocuments({ ...query, assignedTo: staff._id, status: { $in: ['Resolved', 'Closed'] } });
            const inProgress  = await Complaint.countDocuments({ ...query, assignedTo: staff._id, status: 'In Progress' });
            const underReview = await Complaint.countDocuments({ ...query, assignedTo: staff._id, status: 'Review' });
            const open        = await Complaint.countDocuments({ ...query, assignedTo: staff._id, status: 'Open' });

            // Messages sent (activity measure)
            const complaintsWhereMessaged = await Complaint.countDocuments({ 'messages.sender': staff._id });

            // Last activity: find most recent message or complaint update
            const lastActivity = await Complaint.findOne({ 'messages.sender': staff._id })
                .sort({ updatedAt: -1 })
                .select('updatedAt');

            const efficiency = assigned > 0 ? Math.round((resolved / assigned) * 100) : 0;

            // Recent 5 tickets
            const recentTickets = await Complaint.find({ assignedTo: staff._id })
                .sort({ updatedAt: -1 })
                .limit(5)
                .select('complaintId subject status priority createdAt updatedAt')
                .lean();

            return {
                _id: staff._id,
                name: staff.name,
                email: staff.email,
                department: staff.department,
                status: staff.status,
                stats: {
                    assigned,
                    resolved,
                    inProgress,
                    underReview,
                    open,
                    efficiency,
                    messagesCount: complaintsWhereMessaged,
                },
                lastActivity: lastActivity?.updatedAt || staff.createdAt,
                recentTickets,
            };
        }));

        // Sort by resolved count descending (top performers first)
        teamData.sort((a, b) => b.stats.resolved - a.stats.resolved);

        res.json({ success: true, team: teamData });
    } catch (error) {
        next(error);
    }
});

// @desc    Get recent complaints overview for manager
// @route   GET /api/manager/complaints
router.get('/complaints', protect, managerOnly, async (req, res, next) => {
    try {
        const { status, department, limit = 20 } = req.query;

        const filter = {};
        if (status)     filter.status = status;
        if (department) filter.department = department;

        const complaints = await Complaint.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .populate('user', 'name email rollNo')
            .lean();

        res.json({ success: true, complaints });
    } catch (error) {
        next(error);
    }
});

// @desc    Department-wise complaint breakdown
// @route   GET /api/manager/department-stats
router.get('/department-stats', protect, managerOnly, async (req, res, next) => {
    try {
        const { filter = 'all' } = req.query;
        let query = {};

        if (filter !== 'all') {
            const now = new Date();
            let startDate = new Date();
            if (filter === 'daily') startDate.setHours(now.getHours() - 24);
            else if (filter === 'weekly') startDate.setDate(now.getDate() - 7);
            else if (filter === 'monthly') startDate.setMonth(now.getMonth() - 1);
            else if (filter === 'yearly') startDate.setFullYear(now.getFullYear() - 1);
            query.createdAt = { $gte: startDate };
        }

        // Get all unique departments from complaints
        const deptList = await Complaint.distinct('department');

        const deptStats = await Promise.all(deptList.map(async (dept) => {
            const total    = await Complaint.countDocuments({ ...query, department: dept });
            const open     = await Complaint.countDocuments({ ...query, department: dept, status: 'Open' });
            const resolved = await Complaint.countDocuments({ ...query, department: dept, status: { $in: ['Resolved', 'Closed'] } });
            const staff    = await User.countDocuments({ role: 'staff', department: dept });
            const efficiency = total > 0 ? Math.round((resolved / total) * 100) : 0;

            return { department: dept, total, open, resolved, staff, efficiency };
        }));

        // Sort by total descending
        deptStats.sort((a, b) => b.total - a.total);

        res.json({ success: true, departments: deptStats });
    } catch (error) {
        next(error);
    }
});

// @desc    7-day trend for manager
// @route   GET /api/manager/trend
router.get('/trend', protect, managerOnly, async (req, res, next) => {
    try {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const trendData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const nextD = new Date(d);
            nextD.setDate(d.getDate() + 1);

            const submitted = await Complaint.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
            const resolved  = await Complaint.countDocuments({ updatedAt: { $gte: d, $lt: nextD }, status: { $in: ['Resolved', 'Closed'] } });

            trendData.push({ day: days[d.getDay()], submitted, resolved });
        }

        res.json({ success: true, trend: trendData });
    } catch (error) {
        next(error);
    }
});

// @desc    Admin can create a manager account
// @route   POST /api/manager/create
router.post('/create', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            res.status(403);
            throw new Error('Only admin can create manager accounts');
        }

        const { name, email, password, department, phone } = req.body;

        const exists = await User.findOne({ email });
        if (exists) {
            res.status(400);
            throw new Error('Email already exists');
        }

        const manager = await User.create({ name, email, password, department, phone, role: 'manager' });

        res.status(201).json({
            success: true,
            manager: { _id: manager._id, name: manager.name, email: manager.email, role: manager.role, department: manager.department }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
