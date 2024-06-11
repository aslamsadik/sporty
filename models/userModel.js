// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    isBlocked: {  // Add this field
        type: Boolean,
        default: false
    },
    isAdmin: { 
        type: Boolean, 
        default: false
    },
});

const User = mongoose.model('User', userSchema);
module.exports = User;
