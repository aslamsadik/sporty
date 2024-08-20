const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  offerName: { type: String, required: true },
  offerType: { 
    type: String, 
    enum: ['product', 'category', 'referral'], 
    required: true 
  }, 
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: true 
  }, // Percentage or fixed discount
  discountValue: { type: Number, required: true }, // Value of the discount
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() { return this.offerType !== 'referral'; }, 
    refPath: 'offerType'
  }, // Reference to product or category based on offerType
  referralCode: {
    type: String, 
    unique: true, 
    required: function() { return this.offerType === 'referral'; }
  }, // Only required for referral offers
  usageLimit: { type: Number, default: null }, // Optional usage limit (null for unlimited)
  usedCount: { type: Number, default: 0 }, // Track how many times the offer has been used
  startDate: { type: Date, required: true }, // Offer validity start date
  endDate: { type: Date, required: true }, // Offer validity end date
  isActive: { type: Boolean, default: true }, // Whether the offer is active
});


const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
