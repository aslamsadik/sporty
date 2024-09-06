const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  offerName: { 
    type: String, 
    required: true 
  },
  offerType: { 
    type: String, 
    enum: ['product', 'category'], 
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
  applicableProducts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    default: []  // Ensure it defaults to an empty array
  }], 
  applicableCategories: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    default: []  // Ensure it defaults to an empty array
  }], 
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

// Automatically validate that at least one of applicableProducts or applicableCategories is populated
offerSchema.pre('validate', function(next) {
  if (!this.applicableProducts || !this.applicableCategories || 
      (!this.applicableProducts.length && !this.applicableCategories.length)) {
    return next(new Error('Offer must be applied to at least one product or category.'));
  }
  next();
});




const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
