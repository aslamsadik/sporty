const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');


// Define other routes as needed
router.get('/', userController.signUpPage);
router.post('/signup', userController. signUp);
router.get('/login', userController.loginPage);
router.post('/login', userController.login);
router.post('/verifyotp', userController.verifyOtp);
router.get('/home', userController.HomePage);


module.exports = router;
