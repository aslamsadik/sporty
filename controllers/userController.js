const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Helper function to generate a numeric OTP
const generateNumericOtp = (length) => {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10); // Append a random digit (0-9)
    }
    return otp;
};

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const signUpPage = async (req, res) => {
    try {
        return res.render('signupage', { message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const loginPage = async (req, res) => {
    try {
        return res.render('login', { message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const HomePage = async (req, res) => {
    try {
        const products = await Product.find();
        return res.render('home', { products, message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const getShopPage = async (req, res) => {
    try {
        const products = await Product.find();
        res.render('shop', { products });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// const shopPage = async (req, res) => {
//     try {
//         return res.render('shop', { message: null, messageType: null });
//     } catch (error) {
//         console.log(error.message);
//         res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
//     }
// };

const signUp = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Input validation
        if (!username || !email || !password || !confirmPassword) {
            return res.render('signupage', { message: 'All fields are required', messageType: 'error' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('signupage', { message: 'Invalid email format', messageType: 'error' });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.render('signupage', { message: 'Passwords do not match', messageType: 'error' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('signupage', { message: 'User already exists', messageType: 'error' });
        }

        // Generate numeric OTP
        const otpCode = generateNumericOtp(6);

        // Save user info to session
        req.session.signupData = { username, email, password: await bcrypt.hash(password, 10) };

        // Save OTP to the database
        await Otp.create({ email, otp: otpCode });

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'OTP for Sign-Up',
            text: `Your OTP code is ${otpCode}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending OTP email:', error);
                return res.render('signupage', { message: 'Error sending OTP email', messageType: 'error' });
            }
            // Render OTP page with a success message
            res.render('otp_page', { email, message: 'An OTP has been sent to your email. Please check your inbox.', messageType: 'success' });
        });
    } catch (error) {
        console.error('Error during sign-up process:', error.message);
        res.render('signupage', { message: 'Internal Server Error', messageType: 'error' });
    }
};


const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email) {
            return res.render('otp_page', {
                email: '',
                message: 'Email is required',
                messageType: 'error'
            });
        }

        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
            console.error('No OTP record found for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Invalid or expired OTP',
                messageType: 'error'
            });
        }

        if (otpRecord.otp !== otp) {
            console.error('OTP mismatch for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Invalid or expired OTP',
                messageType: 'error'
            });
        }

        // Check if OTP is expired
        const now = new Date();
        const otpAge = (now - otpRecord.createdAt) / 1000; // Age in seconds
        if (otpAge > 30) { // 30 seconds TTL
            console.error('OTP expired for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Invalid or expired OTP',
                messageType: 'error'
            });
        }

        // Retrieve signup data from session
        const { username, password } = req.session.signupData;

        if (!username || !password) {
            console.error('Signup data missing from session for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Signup data is missing. Please sign up again.',
                messageType: 'error'
            });
        }

        // Save the new user to the database
        const newUser = new User({ username, email, password, isVerified: true });
        await newUser.save();

        // Delete the OTP record from the database
        await Otp.deleteOne({ email });

        // Clear signup data from session
        req.session.signupData = null;

        // Redirect to login page with success message
        res.redirect('/login');
    } catch (error) {
        console.error('Error during OTP verification:', error.message);
        res.render('otp_page', {
            email: req.body.email || '', // Ensure email is passed even in case of error
            message: 'Internal Server Error',
            messageType: 'error'
        });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const otpCode = generateNumericOtp(6);

        await Otp.findOneAndUpdate(
            { email },
            { otp: otpCode, createdAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Resend OTP for Sign-Up',
            text: `Your new OTP code is ${otpCode}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending OTP email:', error);
                return res.status(500).json({ success: false, message: 'Error sending OTP email' });
            }
            console.log('OTP email sent: ', info.response);
            res.status(200).json({ success: true, message: 'A new OTP has been sent to your email.' });
        });
    } catch (error) {
        console.error('Error during OTP resending process:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.render('login', { message: 'Email and password are required', messageType: 'error' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('login', { message: 'Invalid email format', messageType: 'error' });
        }

        // Find the user by email
        const user = await User.findOne({ email });

        if (!user || !user.isVerified) {
            return res.render('login', { message: 'Invalid email or password', messageType: 'error' });
        }else if (!user || user.isBlocked) {
            return res.render('login', { message: 'account is blocked', messageType: 'error' });
        }


        // Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { message: 'Invalid email or password', messageType: 'error' });
        }

        // Store user data in session
        req.session.user = { 
            userId: user._id, 
            email: user.email, 
            username: user.username,
            isAdmin: user.isAdmin,  // Ensure this field exists in the user schema
            isBlocked: user.isBlocked
        };

        // Redirect to home page
        res.redirect('/home');
    } catch (error) {
        console.log(error.message);
        res.render('login', { message: 'Internal Server Error', messageType: 'error' });
    }
};

module.exports = {
    signUpPage,
    loginPage,
    signUp,
    login,
    HomePage,
    verifyOtp,
    resendOtp,
    getShopPage
};
