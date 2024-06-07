const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');


// Define other routes as needed
router.get('/', userController.signUpPage);
router.post('/signup', userController. signUp);
router.get('/login', userController.loginPage);
router.post('/login', userController.login);
router.get('/shop', userController.shopPage);
router.post('/verifyotp', userController.verifyOtp);
router.get('/home', userController.HomePage);
router.post('/resend-otp', userController.resendOtp);  // New route for resending OTP


module.exports = router;
