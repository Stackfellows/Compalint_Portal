import express from 'express';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
import User from '../Models/User.js';
import { apiLimiter } from '../Middelware/rateLimiter.js';

const router = express.Router();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey123', {
        expiresIn: '30d',
    });
};

// @desc    Register a new student
// @route   POST /api/auth/register
router.post('/register', apiLimiter, async (req, res, next) => {
    try {
        const { name, email, password, cnic, rollNo, phone } = req.body;

        // 1. Manual Validation for all required fields
        if (!name || !email || !password || !cnic || !rollNo || !phone) {
            res.status(400);
            throw new Error('Please provide all required fields: name, email, password, cnic, rollNo, and phone');
        }

        // 2. Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            res.status(400);
            throw new Error('User already exists with this email');
        }

        // 3. Create user
        try {
            const user = await User.create({
                name,
                email,
                password,
                cnic,
                rollNo,
                phone,
                role: 'student'
            });

            if (user) {
                res.status(201).json({
                    success: true,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        cnic: user.cnic,
                        rollNo: user.rollNo,
                        phone: user.phone,
                    },
                    token: generateToken(user._id),
                });
            } else {
                res.status(400);
                throw new Error('Invalid user data');
            }
        } catch (dbError) {
            // Handle Mongoose duplicate key errors (code 11000)
            if (dbError.code === 11000) {
                res.status(400);
                const field = Object.keys(dbError.keyValue)[0];
                throw new Error(`User with this ${field} already exists`);
            }
            throw dbError; // Rethrow other DB errors to be caught by outer catch
        }
    } catch (error) {
        next(error);
    }
});

// @desc    Auth user & get token (Login)
// @route   POST /api/auth/login
router.post('/login', apiLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Secure Hardcoded Admin Check
        if (email === 'complainthunarmandpunjab@gmail.com' && password === 'admin123') {
            return res.json({
                success: true,
                user: {
                    _id: 'admin_master_123',
                    name: 'System Admin',
                    email: email,
                    role: 'admin',
                },
                token: generateToken('admin_master_123'),
            });
        }

        const user = await User.findOne({ email });

        if (user) {
            const isMatch = await user.matchPassword(password);
            console.log(`🔐 Login Attempt: ${email} | Role: ${user.role} | Match: ${isMatch}`);
            
            if (isMatch) {
                return res.json({
                    success: true,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        department: user.department,
                        cnic: user.cnic,
                        rollNo: user.rollNo,
                        phone: user.phone,
                    },
                    token: generateToken(user._id),
                });
            }
        }
        
        res.status(401);
        throw new Error('Invalid email or password');
    } catch (error) {
        next(error);
    }
});

// @desc    Auth student (Login/Signup from external DB)
// @route   POST /api/auth/student-login
router.post('/student-login', apiLimiter, async (req, res, next) => {
    try {
        const { name, email, password, rollNo } = req.body;

        if (!email || !password) {
            res.status(400);
            throw new Error('Please provide email and password');
        }

        // 1. Check if user already exists in local DB
        let user = await User.findOne({ email });

        if (user) {
            // Student already registered in local system
            const isMatch = await user.matchPassword(password);
            if (isMatch) {
                return res.json({
                    success: true,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        cnic: user.cnic,
                        rollNo: user.rollNo,
                        phone: user.phone,
                    },
                    token: generateToken(user._id),
                });
            } else {
                res.status(401);
                throw new Error('Invalid password');
            }
        }

        // 2. If user doesn't exist locally, they need rollNo to verify against Hunarmand DB
        if (!rollNo) {
            res.status(400);
            throw new Error('Roll Number is required for first-time student login to verify your identity');
        }
        
        if (!name) {
            res.status(400);
            throw new Error('Student Name is required for first-time login account creation');
        }

        // 3. Verify in Hunarmand External DB (on-demand connection)
        const hunarmandUri = process.env.HUNARMAND_DB_URI;
        
        if (!hunarmandUri) {
            res.status(500);
            throw new Error('Hunarmand DB URI is not configured on this server. Please contact admin.');
        }

        let externalUser = null;
        const client = new MongoClient(hunarmandUri, {
            serverSelectionTimeoutMS: 10000,
        });
        
        try {
            await client.connect();
            const hunDb = client.db('hunarmand-prd');
            externalUser = await hunDb.collection('users').findOne({
                email: email,
                rollNumber: rollNo
            });
            console.log(`🔍 Hunarmand DB search: email=${email} rollNumber=${rollNo} found=${!!externalUser}`);
        } catch (dbErr) {
            console.error('❌ Hunarmand DB error:', dbErr.message);
            res.status(500);
            throw new Error('Could not connect to Hunarmand Verification System. Please try again later.');
        } finally {
            await client.close();
        }

        if (!externalUser) {
            res.status(401);
            throw new Error('We could not find a Hunarmand Punjab student with this email and roll number.');
        }

        // 4. Create new User in Local DB with the provided password
        user = await User.create({
            name: name || externalUser.fullName || externalUser.name || 'Student',
            email: email,
            password: password,
            cnic: externalUser.cnic || '',
            rollNo: rollNo,
            phone: externalUser.mobile || externalUser.phone || '',
            role: 'student'
        });

        res.status(201).json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                cnic: user.cnic,
                rollNo: user.rollNo,
                phone: user.phone,
            },
            token: generateToken(user._id),
        });

    } catch (error) {
        next(error);
    }
});

export default router;
