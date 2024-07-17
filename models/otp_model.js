const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 30 // Document expires after 30 seconds
    }
});

const Otp = mongoose.model('Otp', otpSchema);


module.exports = Otp;