const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true },
    description:{ 
        type: String, 
        required: true
     },
    price: { 
        type: Number, 
        required: true 
    },
    brand: { 
        type: String, 
        required: true },
    category: { 
        type: String, 
        required: true },
    images: {
        type: [String],
        validate: [arrayLimit, '{PATH} exceeds the limit of 3'],
    },
});

function arrayLimit(val) {
    return val.length <= 3;
}

module.exports = mongoose.model('Product', productSchema);
