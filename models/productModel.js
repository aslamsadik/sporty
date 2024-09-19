// const mongoose = require('mongoose');

// const productSchema = new mongoose.Schema({
//     name: { 
//         type: String, 
//         required: true 
//     },
//     description: { 
//         type: String, 
//         required: true 
//     },
//     price: { 
//         type: Number, 
//         required: true 
//     },
//     brand: { 
//         type: String, 
//         required: true 
//     },
//     category: { 
//         type: mongoose.Schema.Types.ObjectId,  // Changed to ObjectId
//         ref: 'Category',  // Reference the Category model
//         required: true 
//     },
//     images: {
//         type: [String],
//         validate: [arrayLimit, '{PATH} exceeds the limit of 3'],
//     },
//     stock: { 
//         type: Number, 
//         required: true, 
//         default: 0 
//     },
//     discount: { 
//         type: Number, 
//         default: 0  // Discount applied to the product
//     }
// });

// function arrayLimit(val) {
//     return val.length <= 3;
// }

// module.exports = mongoose.model('Product', productSchema);


const mongoose = require('mongoose');

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
        type: mongoose.Schema.Types.ObjectId,  // Changed to ObjectId
        ref: 'Category',  // Reference the Category model
        required: true 
    },
    images: {
        type: [String],
        validate: [arrayLimit, '{PATH} exceeds the limit of 3'],
    },
    stock: { 
        type: Number, 
        required: true, 
        default: 0 
    },
    DiscountApplied: { 
                 type: Number, 
                 default: 0  // Discount applied to the product
             } 
});

function arrayLimit(val) {
    return val.length <= 3;
}

module.exports = mongoose.model('Product', productSchema);