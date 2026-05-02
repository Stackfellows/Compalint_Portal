import jwt from 'jsonwebtoken';
import User from '../Models/User.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
            
            // Check for Hardcoded Admin first
            if (decoded.id === 'admin_master_123') {
                req.user = {
                    _id: 'admin_master_123',
                    name: 'System Admin',
                    email: 'complainthunarmandpunjab@gmail.com',
                    role: 'admin'
                };
            } else {
                req.user = await User.findById(decoded.id).select('-password');
            }
            
            if (!req.user) {
                res.status(401);
                throw new Error('User not found');
            }
            next();
        } catch (error) {
            console.error('JWT Verification Error:', error.message);
            res.status(401);
            next(new Error('Not authorized, token failed'));
        }
    }

    if (!token) {
        res.status(401);
        next(new Error('Not authorized, no token'));
    }
};

export const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403);
        next(new Error('Not authorized as an admin'));
    }
};

export const staffOrAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'staff' || req.user.role === 'manager')) {
        next();
    } else {
        res.status(403);
        next(new Error('Not authorized as staff or admin'));
    }
};

export const managerOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'manager' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403);
        next(new Error('Not authorized as manager'));
    }
};
