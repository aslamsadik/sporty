const User = require('../models/userModel');

const isBlockedMiddleware = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user.userId);
            if (user && user.isBlocked) {
                req.session.destroy((err) => {
                    if (err) {
                        return next(err);
                    }
                    return res.redirect('/');
                });
            } else {
                next();
            }
        } catch (error) {
            console.log(error.message);
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
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        return res.redirect('/');
    }
};

// Middleware to check if the user is not authenticated
const isNotAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return next();
    } else {
        return res.redirect('/home');
    }
};

module.exports = { 
    isBlockedMiddleware,
    addNoCacheHeaders,
    isAuthenticated,
    isNotAuthenticated
};
