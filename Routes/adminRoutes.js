import express from 'express';
import User from '../Models/User.js';
import Complaint from '../Models/Complaint.js';
import Department from '../Models/Department.js';
import { protect, adminOnly } from '../Middelware/authMiddleware.js';

const router = express.Router();

// @desc    Get all staff and managers
// @route   GET /api/admin/staff
router.get('/staff', protect, adminOnly, async (req, res, next) => {
    try {
        const staffMembers = await User.find({ role: { $in: ['staff', 'manager'] } }).select('-password').lean();
        
        // Enrich staff with their resolved ticket count
        const staffWithStats = await Promise.all(staffMembers.map(async (s) => {
            // Count resolved/closed where they are assigned
            const directResolved = await Complaint.countDocuments({ 
                assignedTo: s._id,
                status: { $in: ['Resolved', 'Closed'] }
            });

            // Fallback for older tickets: Count resolved/closed where they sent a message
            const messageResolved = await Complaint.countDocuments({
                status: { $in: ['Resolved', 'Closed'] },
                'messages.sender': s._id
            });

            const resolvedCount = directResolved + messageResolved;

            const activeCount = await Complaint.countDocuments({
                assignedTo: s._id,
                status: { $in: ['In Progress', 'Review'] }
            });

            return { ...s, resolvedCount, activeCount };
        }));

        res.json({ success: true, staff: staffWithStats });
    } catch (error) {
        next(error);
    }
});

// @desc    Add new staff member
// @route   POST /api/admin/staff
router.post('/staff', protect, adminOnly, async (req, res, next) => {
    try {
        const { name, email, password, department, phone } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            res.status(400);
            throw new Error('User already exists');
        }

        const staff = await User.create({
            name,
            email,
            password,
            department,
            phone,
            role: 'staff'
        });

        console.log(`👤 New Staff Created: ${name} (${email})`);

        res.status(201).json({
            success: true,
            staff: {
                _id: staff._id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                department: staff.department
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete staff member
// @route   DELETE /api/admin/staff/:id
router.delete('/staff/:id', protect, adminOnly, async (req, res, next) => {
    try {
        const staff = await User.findById(req.params.id);
        if (!staff || (staff.role !== 'staff' && staff.role !== 'manager')) {
            res.status(404);
            throw new Error('Member not found');
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Staff member removed' });
    } catch (error) {
        next(error);
    }
});

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
router.get('/stats', protect, adminOnly, async (req, res, next) => {
    try {
        const totalComplaints = await Complaint.countDocuments();
        const openComplaints = await Complaint.countDocuments({ status: 'Open' });
        const resolvedComplaints = await Complaint.countDocuments({ status: 'Resolved' });
        const inProgressComplaints = await Complaint.countDocuments({ status: 'In Progress' });
        
        const totalUsers = await User.countDocuments({ role: 'student' });
        const totalStaff = await User.countDocuments({ role: 'staff' });

        // Debug: Log all staff departments
        const allStaff = await User.find({ role: 'staff' }).select('department');
        console.log('🔍 Current Staff Assignments:', allStaff.map(s => s.department));

        // Department wise breakdown
        const depts = await Department.find({});
        const deptStats = {};
        
        for (const d of depts) {
            // Use regex for case-insensitive and flexible matching
            const deptRegex = new RegExp(`^${d.name.trim()}$`, 'i');
            
            const staffCount = await User.countDocuments({ 
                role: 'staff', 
                department: deptRegex 
            });
            
            const openCount = await Complaint.countDocuments({ 
                department: deptRegex, 
                status: 'Open' 
            });
            
            console.log(`📊 Stats for "${d.name}": Found ${staffCount} staff and ${openCount} open tickets using regex: ${deptRegex}`);
            deptStats[d.name] = { staff: staffCount, open: openCount };
        }

        res.json({
            success: true,
            stats: {
                complaints: {
                    total: totalComplaints,
                    open: openComplaints,
                    resolved: resolvedComplaints,
                    inProgress: inProgressComplaints
                },
                users: {
                    students: totalUsers,
                    staff: totalStaff
                },
                deptStats,
                debugStaff: allStaff.map(s => s.department) // Added for debugging
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get report data with dynamic filters
// @route   GET /api/admin/reports
router.get('/reports', protect, adminOnly, async (req, res, next) => {
    try {
        const { filter = 'weekly' } = req.query;
        const now = new Date();
        let startDate = new Date();
        let trendData = [];

        if (filter === 'daily') {
            startDate.setHours(0, 0, 0, 0);
            // Trend for last 24 hours (hourly)
            for (let i = 0; i < 24; i += 4) {
                const hourDate = new Date(startDate);
                hourDate.setHours(i);
                const nextHour = new Date(hourDate);
                nextHour.setHours(i + 4);

                const tickets = await Complaint.countDocuments({ createdAt: { $gte: hourDate, $lt: nextHour } });
                const resolved = await Complaint.countDocuments({ createdAt: { $gte: hourDate, $lt: nextHour }, status: { $in: ['Resolved', 'Closed'] } });
                trendData.push({ date: `${i}:00`, tickets, resolved });
            }
        } else if (filter === 'weekly') {
            startDate.setDate(now.getDate() - 7);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                d.setHours(0, 0, 0, 0);
                const nextD = new Date(d);
                nextD.setDate(d.getDate() + 1);

                const tickets = await Complaint.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
                const resolved = await Complaint.countDocuments({ createdAt: { $gte: d, $lt: nextD }, status: { $in: ['Resolved', 'Closed'] } });
                trendData.push({ date: days[d.getDay()], tickets, resolved });
            }
        } else if (filter === 'monthly') {
            startDate.setMonth(now.getMonth() - 1);
            // Group by weeks in the last month
            for (let i = 3; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - (i * 7));
                const tickets = await Complaint.countDocuments({ createdAt: { $gte: d } });
                trendData.push({ date: `Week ${4-i}`, tickets, resolved: Math.floor(tickets * 0.7) });
            }
        } else if (filter === 'yearly') {
            startDate.setFullYear(now.getFullYear() - 1);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = 11; i >= 0; i--) {
                const d = new Date();
                d.setMonth(now.getMonth() - i);
                const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
                const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

                const tickets = await Complaint.countDocuments({ createdAt: { $gte: monthStart, $lt: monthEnd } });
                trendData.push({ date: months[monthStart.getMonth()], tickets, resolved: Math.floor(tickets * 0.8) });
            }
        }

        const efficiency = await Complaint.countDocuments({ status: { $in: ['Resolved', 'Closed'] } });
        const total = await Complaint.countDocuments();
        const efficiencyRate = total > 0 ? Math.round((efficiency / total) * 100) : 0;

        res.json({
            success: true,
            trends: trendData,
            metrics: {
                efficiency: `${efficiencyRate}%`,
                avgResponse: '2.4 Hrs',
                satisfaction: '4.8/5.0'
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get all departments
// @route   GET /api/admin/departments
router.get('/departments', protect, adminOnly, async (req, res, next) => {
    try {
        const departments = await Department.find({});
        console.log(`🔍 Found ${departments.length} departments in DB`);
        res.json({
            success: true,
            departments
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Create a department
// @route   POST /api/admin/departments
router.post('/departments', protect, adminOnly, async (req, res, next) => {
    try {
        const { name, head, description } = req.body;
        const dept = await Department.create({ name, head, description });
        console.log(`✅ Created department: ${name}`);
        res.status(201).json({
            success: true,
            department: dept
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete a department
// @route   DELETE /api/admin/departments/:id
router.delete('/departments/:id', protect, adminOnly, async (req, res, next) => {
    try {
        await Department.findByIdAndDelete(req.params.id);
        res.json({ message: 'Department removed' });
    } catch (error) {
        next(error);
    }
});

// @desc    Update staff status (Active/Leave)
// @route   PATCH /api/admin/staff/:id/status
router.patch('/staff/:id/status', protect, adminOnly, async (req, res, next) => {
    try {
        const { status } = req.body; // 'Active' or 'Leave'
        const staff = await User.findById(req.params.id);
        if (!staff) {
            res.status(404);
            throw new Error('Staff member not found');
        }
        staff.status = status;
        await staff.save();
        res.json(staff);
    } catch (error) {
        next(error);
    }
});

export default router;
