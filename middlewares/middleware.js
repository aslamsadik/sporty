const User = require('../models/userModel');

// Middleware to check if the user is blocked
const isBlockedMiddleware = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user.userId);
            if (user && user.isBlocked) {
                // Clear only the user session data
                delete req.session.user;

                console.log(`Blocked user attempted access: ${user.email}`);
                return res.redirect('/admin/userManagement');  // Redirect to user management page
            } else {
                next();
            }
        } catch (error) {
            console.error('Error in isBlockedMiddleware:', error.message);
            res.status(500).send('Internal Server Error');
        }
    } else {
        next();
    }
};


// Middleware to add no-cache headers
const addNoCacheHeaders = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
};

// Middleware to check if the user is authenticated
const isAuthenticated = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user.userId);
            if (user) {
                return next();
            } else {
                req.session.destroy((err) => {
                    if (err) {
                        return next(err);
                    }
                    console.log('User session exists but user not found in the database. Redirecting to signup page.');
                    return res.redirect('/signup');
                });
            }
        } catch (error) {
            console.error('Error in isAuthenticated middleware:', error.message);
            res.status(500).send('Internal Server Error');
        }
    } else {
        console.log('User not authenticated. Redirecting to signup page.');
        return res.redirect('/signup');
    }
};

// Middleware to check if the user is not authenticated
const isNotAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return next();
    } else {
        console.log('Authenticated user attempted to access login/register page. Redirecting to home page.');
        return res.redirect('/home');
    }
};

// Admin authentication
const isAdminAuthenticated = (req, res, next) => {
    if (req.session && req.session.admin) {
        return next();
    } else {
        return res.redirect('/admin/login');
    }
};

const isAdminNotAuthenticated = (req, res, next) => {
    if (!req.session && !req.session.admin) {
        return res.redirect('/admin/home');
    } else {
        return next();
    }
};

module.exports = { 
    isBlockedMiddleware,
    addNoCacheHeaders,
    isAuthenticated,
    isNotAuthenticated,
    isAdminAuthenticated,
    isAdminNotAuthenticated
    
};