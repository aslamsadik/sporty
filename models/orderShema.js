const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    products: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true }
    }],
    billingAddress: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        companyName: { type: String },
        address1: { type: String, required: true },
        address2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zip: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true }
    },
    shippingAddress: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        companyName: { type: String },
        address1: { type: String, required: true },
        address2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zip: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true }
    },
    totalPrice: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    orderNotes: { type: String },
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
