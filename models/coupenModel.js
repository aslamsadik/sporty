const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    maxDiscountValue: { type: Number, default: 100 }, // New field to set max discount limit
    minPrice: { type: Number, default: 0 },
    expirationDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});


const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
