const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const { isBlockedMiddleware } = require('../middlewares/adminAuth');


// Google OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/home');
  }
);

// Facebook OAuth Routes
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/home');
  }
);

// Apply isBlockedMiddleware to all routes that require the user to be logged in
router.use(isBlockedMiddleware);


// Define other routes as needed
router.get('/', userController.signUpPage);
router.post('/signup', userController. signUp);
router.get('/login', userController.loginPage);
router.post('/login', userController.login);
router.post('/verifyotp', userController.verifyOtp);
router.get('/home', userController.HomePage);
router.post('/resend-otp', userController.resendOtp);  // New route for resending OTP
router.get('/shop', userController.getShopPage);// Route for the shop page
router.get('/product/:id', userController.getProductDescriptionPage);

module.exports = router;
