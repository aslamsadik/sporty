const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  offerName: { 
    type: String, 
    required: true 
  },
  offerType: { 
    type: String, 
    enum: ['product', 'category', 'referral'], 
    required: true 
  },
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: true 
  },
  discountValue: { 
    type: Number, 
    required: true 
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() { 
      return this.offerType !== 'referral'; 
    },
    refPath: 'offerType'
  },
  referralCode: {
    type: String,
    unique: true,  // Ensures that referralCode is unique if provided
    sparse: true,  // Only applies uniqueness when referralCode is not null
    required: function() { 
      return this.offerType === 'referral'; 
    } // Only required for referral offers
  },
  usageLimit: { 
    type: Number, 
    default: null 
  },
  usedCount: { 
    type: Number, 
    default: 0 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
});

// Validate targetId is provided for product or category offers
offerSchema.path('targetId').validate(function(value) {
  if (this.offerType !== 'referral' && !value) {
    return false;
  }
  return true;
}, 'Target ID is required for product or category offers.');

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;