const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const { isBlockedMiddleware, addNoCacheHeaders, isAuthenticated, isNotAuthenticated } = require('../middlewares/middleware');

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
router.get('/signup', addNoCacheHeaders, isNotAuthenticated, userController.signUpPage);
router.post('/signup', addNoCacheHeaders, isNotAuthenticated, userController.signUp);
router.get('/', addNoCacheHeaders, isNotAuthenticated, userController.loginPage);
router.post('/login', addNoCacheHeaders, isNotAuthenticated, userController.login);
router.get('/logout', isAuthenticated, userController.logout);
router.post('/verifyotp', addNoCacheHeaders, isNotAuthenticated, userController.verifyOtp);
router.get('/home', isAuthenticated, userController.HomePage);
router.post('/resend-otp', addNoCacheHeaders, isNotAuthenticated, userController.resendOtp);
router.get('/shop', isAuthenticated, userController.getShopPage);
router.get('/product/:id', isAuthenticated, userController.getProductDescriptionPage);
router.get('/profile', isAuthenticated, userController.profilePage);

// Cart routes
router.get('/cart', isAuthenticated, userController.getCart);
router.post('/cart/add', isAuthenticated, userController.addToCart);
router.post('/cart/remove', isAuthenticated, userController.removeFromCart);
router.post('/cart/clear', isAuthenticated,userController.clearCart);
//checkout
router.get('/checkout', isAuthenticated,userController.getCheckout)

module.exports = router;