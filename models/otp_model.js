const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 30 // OTP expires in 30 seconds
    }
});


const Otp = mongoose.model('Otp', otpSchema);
module.exports = Otp;
