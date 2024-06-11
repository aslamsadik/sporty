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
                    return res.redirect('/login');
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

module.exports = { isBlockedMiddleware };
