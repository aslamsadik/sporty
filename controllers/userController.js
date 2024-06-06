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
        return res.render('signupage'); // Ensure this matches the view file name
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const loginPage = async (req, res) => {
    try {
        return res.render('login'); // Ensure this matches the view file name
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const HomePage = async (req, res) => {
    try {
        const products = await Product.find();
        return res.render('home', { products }); // Ensure this matches the view file name
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};




const signUp = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Input validation
        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).send('All fields are required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).send('Invalid email format');
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.status(400).send('Passwords do not match');
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('User already exists');
        }

        // Generate numeric OTP
        const otpCode = generateNumericOtp(6); // Generate a 6-digit numeric OTP

        // Save user info to session
        req.session.signupData = { username, email, password: bcrypt.hashSync(password, 10) };

        // Save OTP to the database
        const otp = new Otp({ email, otp: otpCode });
        await otp.save();
        console.log('OTP saved to database:', otp);
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
                return res.status(500).send('Error sending OTP email');
            }
            // Render OTP page with a success message
            res.render('otp_page', { email, message: 'An OTP has been sent to your email. Please check your inbox.' });
        });
    } catch (error) {
        console.error('Error during sign-up process:', error.message);
        res.status(500).send('Internal Server Error');
    }
};


const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const signupData = req.session.signupData;

        if (!signupData || signupData.email !== email) {
            return res.status(400).send('Invalid session or email');
        }

        // Find OTP record in the database
        const otpRecord = await Otp.findOne({ email });
        console.log('OTP record found:', otpRecord);
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).send('Invalid or expired OTP');
        }

        // OTP verified, create new user in the database
        const newUser = new User({
            username: signupData.username,
            email: signupData.email,
            password: signupData.password
        });
        await newUser.save();

        // Clear signup data from session and delete OTP record after successful OTP verification
        req.session.signupData = null;
        await Otp.deleteOne({ email });

        // Redirect to login page
        res.redirect('/login');
    } catch (error) {
        console.error('Error during OTP verification:', error.message);
        res.status(500).send('Internal Server Error');
    }
};



const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.status(400).send('Email and password are required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).send('Invalid email format');
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).send('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).send('Invalid email or password');
        }

        // Handle successful login by storing user data in session
        req.session.user = { userId: user._id, email: user.email, username: user.username };

        // Redirect to home page or any other desired page after login
        res.redirect('/home');
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};


module.exports = {
    signUpPage,
    loginPage,
    signUp,
    login,
    HomePage,
    verifyOtp
};
