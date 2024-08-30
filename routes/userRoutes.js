const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const { isBlockedMiddleware, addNoCacheHeaders, isAuthenticated, isNotAuthenticated } = require('../middlewares/middleware');
const { createRazorpayOrder } = require('../controllers/userController'); // Adjust the path as necessary

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
router.get('/login', addNoCacheHeaders, isNotAuthenticated, userController.loginPage);
router.post('/login', addNoCacheHeaders, isNotAuthenticated, userController.login);
router.get('/logout', isAuthenticated, userController.logout);
router.post('/verifyotp', addNoCacheHeaders, isNotAuthenticated, userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);

// Home and Shop pages accessible to guests
router.get('/', userController.HomePage);
router.get('/search', userController.search);
router.get('/shop', userController.getShopPage);
router.get('/product/:id', userController.getProductDescriptionPage);


// Cart routes (protected)
router.get('/cart', isAuthenticated, userController.getCart);
router.post('/cart/add', isAuthenticated, userController.addToCart);
router.post('/cart/remove', isAuthenticated, userController.removeFromCart);
router.post('/cart/clear', isAuthenticated, userController.clearCart);
router.post('/cart/update', isAuthenticated, userController.updateCart);

// Checkout (protected)
router.get('/checkout', isAuthenticated, userController.getCheckoutPage);
router.post('/place-order', isAuthenticated, userController.placeOrder);
router.get('/orderConfirm/:orderId', isAuthenticated, userController.getOrderConfirmpage);
router.post('/order/cancel/:orderId', isAuthenticated, userController.cancelOrder);
router.get('/orders', isAuthenticated, userController.getOrderListing);
router.get('/orderDetails/:orderId', isAuthenticated, userController.getOrderDetails);
router.post('/order/return/:orderId', isAuthenticated, userController.returnOrder);

// Profile and address management (protected)
router.get('/profile', isAuthenticated, userController.getProfilePage);
router.get('/profile/add-addressPage', isAuthenticated, userController.getaddresPage);
router.post('/profile/add-address', isAuthenticated, userController.addAddress);
router.get('/profile/edit-address/:id', isAuthenticated, userController.getEditAddressPage);
router.post('/profile/edit-address/:id', isAuthenticated, userController.editAddress);
router.post('/profile/delete-address/:id', isAuthenticated, userController.deleteAddress);
router.post('/editprofile', isAuthenticated, userController.updateProfile);

// Forgot Password routes
router.get('/forgotPassword', userController.getforgotPassword);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// Apply coupon
router.post('/apply-coupon', userController.applyCoupon);

// Wishlist routes
router.post('/wishlist/add', isAuthenticated, userController.addToWishlist);
router.post('/wishlist/remove', isAuthenticated, userController.removeFromWishlist);
router.get('/wishlist', isAuthenticated, userController.getWishlist);

// Route to get wallet details
router.get('/wallet',isAuthenticated, userController.getWalletDetails);
router.post('/wallet/add-funds', userController.addFunds);


router.post('/apply-offer',isAuthenticated, userController.applyOffer);



module.exports = router;
