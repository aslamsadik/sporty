const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
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
});

const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    },
    brand: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        required: true 
    },
    images: {
        type: [String],
        validate: [arrayLimit, '{PATH} exceeds the limit of 3'],
    },
    addresses: [addressSchema] // Added addresses field
});

function arrayLimit(val) {
    return val.length <= 3;
}

module.exports = mongoose.model('Product', productSchema);
