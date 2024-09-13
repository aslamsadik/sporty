const mongoose = require('mongoose');

// const orderSchema = new mongoose.Schema({
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     products: [
//         {
//             productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
//             quantity: { type: Number, required: true }
//         }
//     ],
//     shippingAddressId: { type: mongoose.Schema.Types.ObjectId, required: true },
//     totalPrice: { type: Number, required: true },
//     discountAmount: { type: Number, default: 0 },
//     paymentMethod: { type: String, required: true },
//     orderNotes: { type: String },
//     status: { type: String, default: 'Pending' },
//     createdAt: { type: Date, default: Date.now },
//     updatedAt: { type: Date, default: Date.now }
// });

// const orderSchema = new mongoose.Schema({
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     products: [
//         {
//             productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
//             quantity: { type: Number, required: true }
//         }
//     ],
//     shippingAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
//     totalPrice: { type: Number, required: true },
//     discountAmount: { type: Number, default: 0 },
//     paymentMethod: { type: String, required: true },
//     orderNotes: { type: String },
//     status: { type: String, default: 'Pending' },
//     createdAt: { type: Date, default: Date.now },
//     updatedAt: { type: Date, default: Date.now },
//     couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' } // Optional
// });

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            quantity: { type: Number, required: true }
        }
    ],
    shippingAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
    totalPrice: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    offfersDiscount:{ type: Number, default:0},
    couponDeduction:{ type:Number, default:0},
    paymentMethod: { type: String, required: true },
    orderNotes: { type: String },
    status: { type: String, default: 'Pending' },
    returnRequested: { type: Boolean, default: false }, // New field
    returnReason: { type: String }, // New field
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }
});


const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
