const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cartSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    products: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true },
        priceAfterOffer: { type: Number, default: 0 },  // New field for price after offer
        offerDiscount: { type: Number, default: 0 }     // New field for storing the offer discount amount
    }],
    totalPrice: { type: Number, default: 0 }
});

module.exports = mongoose.model('Cart', cartSchema);
