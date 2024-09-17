
const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Offer = require('../models/offerModel');
const Order = require('../models/orderShema'); // Adjust the path as necessary
const Coupon = require('../models/coupenModel');
const Wallet = require('../models/walletModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const moment = require('moment');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ExcelJS = require('exceljs');


const Admin_login = async (req, res) => {
    try {
        return res.render('admin_login',{ message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const Admin_loginFunction = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Login attempt for admin: ${email}`);

        // Find the user by email
        const user = await User.findOne({ email });

        // Check if user exists and is an admin
        if (!user || !user.isAdmin || !user.isVerified) {
            console.log('Unauthorized access attempt or user not found');
            return res.render('admin_login', { message: 'Only verified admins are allowed to enter', messageType: 'error' });
        }

        // Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Invalid password attempt');
            return res.render('admin_login', { message: 'Invalid email or password', messageType: 'error' });
        }

        // Store user data in session
        req.session.admin = { 
            userId: user._id, 
            email: user.email, 
            username: user.username,
            isAdmin: user.isAdmin,
            isBlocked: user.isBlocked
        };

        console.log('Admin logged in successfully');
        // Redirect to admin home page
        return res.redirect('/admin/Admin_home');
    } catch (error) {
        console.log('Error during admin login:', error.message);
        res.status(500).send('Internal Server Error');
    }
}

const Admin_logout = async (req, res) => {
    try {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err.message);
                return res.status(500).send('Internal Server Error');
            }
            console.log('Admin logged out successfully');
            // Redirect to the login page after logout
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.error('Error logging out:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

// const Admin_home = async (req, res) => {
//     try {
//         const filters = {
//             startDate: req.query.startDate || '',
//             endDate: req.query.endDate || '',
//             category: req.query.category || '',
//         };

//         const categories = await Category.find();

//         const totalRevenue = await Order.aggregate([
//             { $match: { status: "Delivered" } },  // Changed to "Delivered"
//             { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } }
//         ]);

//         const totalOrders = await Order.countDocuments({ status: "Delivered" });  // Changed to "Delivered"

//         const monthlyEarnings = await Order.aggregate([
//             { 
//                 $match: { 
//                     status: "Delivered",  // Changed to "Delivered"
//                     createdAt: {
//                         $gte: new Date(new Date().setDate(1)) // Start of the current month
//                     }
//                 }
//             },
//             { $group: { _id: null, monthlyEarnings: { $sum: "$totalPrice" } } }
//         ]);

//         // Reuse the getSalesReport logic to fetch sales data for the initial load
//         const { startDate, endDate, category } = filters;
//         let matchCriteria = { status: "Delivered" };  // Changed to "Delivered"

//         if (startDate && endDate) {
//             matchCriteria.createdAt = {
//                 $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),  // Start of the day
//                 $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) // End of the day
//             };
//         }

//         if (category) {
//             matchCriteria['products.category'] = category;
//         }

//         const salesData = await Order.aggregate([
//             { $match: matchCriteria },
//             { $unwind: "$products" },
//             { 
//                 $lookup: {
//                     from: "products", 
//                     localField: "products.productId",
//                     foreignField: "_id",
//                     as: "productDetails"
//                 }
//             },
//             { $unwind: "$productDetails" },
//             { 
//                 $group: {
//                     _id: "$products.productId",
//                     productName: { $first: "$productDetails.name" },
//                     totalQuantity: { $sum: "$products.quantity" },
//                     totalRevenue: { $sum: { $multiply: ["$products.quantity", "$productDetails.price"] } }
//                 }
//             }
//         ]);

//         // Generate query string
//         const queryString = new URLSearchParams(filters).toString();

//         res.render('dashboard', {
//             totalRevenue: totalRevenue[0]?.totalRevenue || 0,
//             totalOrders,
//             monthlyEarnings: monthlyEarnings[0]?.monthlyEarnings || 0,
//             categories, 
//             filters, 
//             salesData, 
//             queryString // Pass queryString to the template
//         });
//     } catch (error) {
//         console.log(error.message);
//         res.status(500).send('Internal Server Error');
//     }
// };

// const Admin_home = async (req, res) => {
//     try {
//         const filters = {
//             startDate: req.query.startDate || '',
//             endDate: req.query.endDate || '',
//             category: req.query.category || '',
//         };

//         const categories = await Category.find(); // Fetch categories for the dropdown

//         const { startDate, endDate, category } = filters;
//         let matchCriteria = { status: "Delivered" }; // Adjust to match your order statuses

//         if (startDate && endDate) {
//             matchCriteria.createdAt = {
//                 $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
//                 $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
//             };
//         }

//         let salesDataPipeline = [
//             { $match: matchCriteria },
//             { $unwind: "$products" },
//             {
//                 $lookup: {
//                     from: "products",
//                     localField: "products.productId",
//                     foreignField: "_id",
//                     as: "productDetails"
//                 }
//             },
//             { $unwind: "$productDetails" },
//             {
//                 $lookup: {
//                     from: "categories",
//                     localField: "productDetails.category",
//                     foreignField: "_id",
//                     as: "categoryDetails"
//                 }
//             },
//             { $unwind: "$categoryDetails" },
//         ];

//         if (category) {
//             salesDataPipeline.push({
//                 $match: { "categoryDetails._id": mongoose.Types.ObjectId(category) }
//             });
//         }

//         salesDataPipeline.push({
//             $group: {
//                 _id: "$products.productId",
//                 productName: { $first: "$productDetails.name" },
//                 category: { $first: "$categoryDetails.name" }, // Get the category name
//                 totalQuantity: { $sum: "$products.quantity" },
//                 totalRevenue: { $sum: { $multiply: ["$products.quantity", "$productDetails.price"] } }
//             }
//         });

//         const salesData = await Order.aggregate(salesDataPipeline);
//         const queryString = new URLSearchParams(filters).toString();

//         res.render('dashboard', {
//             categories,
//             filters,
//             salesData,
//             queryString
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Internal Server Error');
//     }
// };

const Admin_home = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate || '',
            endDate: req.query.endDate || '',
            category: req.query.category || '',
        };

        const categories = await Category.find(); // Fetch categories for the dropdown

        const { startDate, endDate, category } = filters;
        let matchCriteria = { status: "Delivered" }; // Adjust to match your order statuses

        if (startDate && endDate) {
            matchCriteria.createdAt = {
                $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        let salesDataPipeline = [
            { $match: matchCriteria },
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
        ];

        if (category) {
            salesDataPipeline.push({
                $match: { "categoryDetails._id": mongoose.Types.ObjectId(category) }
            });
        }

        salesDataPipeline.push({
            $group: {
                _id: "$products.productId",
                productName: { $first: "$productDetails.name" },
                category: { $first: "$categoryDetails.name" }, // Get the category name
                totalQuantity: { $sum: "$products.quantity" },
                totalRevenue: { $sum: { $multiply: ["$products.quantity", "$productDetails.price"] } },
                totalDiscount: { $sum: "$products.discount" }, // Assuming you have discount data
                couponsDeduction: { $sum: "$products.couponsDeduction" } // Assuming you have coupons deduction data
            }
        });

        // Fetching sales data per product
        const salesData = await Order.aggregate(salesDataPipeline);

        // Fetching overall sales data
        const overallSales = await Order.aggregate([
            { $match: matchCriteria },
            {
                $group: {
                    _id: null,
                    overallSalesCount: { $sum: 1 }, // Each order counts as one
                    overallOrderAmount: { $sum: '$totalPrice' },
                    overallDiscount: { $sum: '$discountAmount' }, // Assuming you have this field
                    overallCouponsDeduction: { $sum: { $ifNull: ['$coupon.discountValue', 0] } } // Assuming coupon deduction
                }
            }
        ]);

        // Default to zero if no data exists
        const overallSalesData = overallSales[0] || { 
            overallSalesCount: 0, 
            overallOrderAmount: 0, 
            overallDiscount: 0, 
            overallCouponsDeduction: 0 
        };

        const queryString = new URLSearchParams(filters).toString();

        // Render the dashboard with sales data and overall stats
        res.render('dashboard', {
            categories,
            filters,
            salesData,
            overallSalesCount: overallSalesData.overallSalesCount,
            overallOrderAmount: overallSalesData.overallOrderAmount,
            overallDiscount: overallSalesData.overallDiscount,
            overallCouponsDeduction: overallSalesData.overallCouponsDeduction,
            queryString
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};

// Product Management
// const Admin_productList = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 10; // Number of products per page
//         const totalProducts = await Product.countDocuments();
//         const totalPages = Math.ceil(totalProducts / limit);

//         const products = await Product.find()
//             .skip((page - 1) * limit)
//             .limit(limit);

//         return res.render('productList', {
//             products,
//             currentPage: page,
//             totalPages,
//         });
//     } catch (error) {
//         console.log(error.message);
//         res.status(500).send('Internal Server Error');
//     }
// };

const Admin_productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of products per page
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find()
            .populate('category')  // Populating category to show category name
            .skip((page - 1) * limit)
            .limit(limit);

        return res.render('productList', {
            products,
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};



const Admin_addProductPage = async (req, res) => {
    try {
        // Fetch all categories for the dropdown
        const categories = await Category.find();

        return res.render('productManagement', {
            message: null,
            messageType: null,
            categories  // Pass categories to the view
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

// 
const Admin_addProduct = async (req, res) => {
    try {
        const { name, description, price, brand, category, stock } = req.body;
        const images = req.files.map(file => file.filename);

        // Check if a product with the same name already exists
        const existingProduct = await Product.findOne({ name });
        if (existingProduct) {
            return res.render('productManagement', { 
                message: 'Product already exists.', 
                messageType: 'error', 
                product: req.body,
                categories: await Category.find()
            });
        }

        // Check if the category exists by name and get its ID
        const validCategory = await Category.findOne({ name: category });
        if (!validCategory) {
            return res.render('productManagement', { 
                message: 'Category does not exist.', 
                messageType: 'error', 
                product: req.body,
                categories: await Category.find()
            });
        }

        // Now, use validCategory._id as the category for the new product
        const newProduct = new Product({ 
            name, 
            description, 
            price, 
            brand, 
            category: validCategory._id,  // Assign the ObjectId here
            stock, 
            images 
        });

        await newProduct.save();

        res.redirect('/admin/productList');
    } catch (error) {
        console.log(error.message);
        res.status(500).render('productManagement', { 
            message: 'Internal Server Error', 
            messageType: 'error', 
            product: req.body,
            categories: await Category.find()
        });
    }
};

const Admin_editProductPage = async (req, res) => {
    try {
        const productId = req.params.id;

        // Fetch the product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect('/admin/productList');  // Redirect if product is not found
        }

        // Fetch categories
        const categories = await Category.find();

        // Render the edit product page with default message and messageType
        res.render('editProduct', {
            product,
            categories,
            message: req.query.message || null,  // Pass message from query params
            messageType: req.query.messageType || null  // Pass message type from query params
        });
    } catch (error) {
        console.error(error.message);
        res.redirect('/admin/productList?message=Internal Server Error&messageType=error');  // Redirect with query params for error
    }
};
//real edit product

// const Admin_editProduct = async (req, res) => {
//     try {
//         const { name, description, price, brand, category, stock } = req.body;
//         const productId = req.params.id;
//         const images = req.files ? req.files.map(file => file.filename) : [];

//         // Find the product to be updated
//         const product = await Product.findById(productId);
//         if (!product) {
//             return res.redirect('/admin/productList?message=Product not found&messageType=error');
//         }

//         // Update product details
//         product.name = name;
//         product.description = description;
//         product.price = price;
//         product.brand = brand;
//         product.category = category;
//         product.stock = stock; // Update stock

//         if (images.length > 0) {
//             product.images = images.slice(0, 3); // Only update images if new ones are uploaded
//         }

//         await product.save();

//         res.redirect('/admin/productList');
//     } catch (error) {
//         console.error(error.message);
//         res.redirect(`/admin/editProduct/${req.params.id}?message=Internal Server Error&messageType=error`);
//     }
// };

const Admin_editProduct = async (req, res) => {
    try {
        const { name, description, price, brand, category, stock } = req.body;
        const productId = req.params.id;
        const images = req.files ? req.files.map(file => file.filename) : [];

        // Find the product to be updated
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect('/admin/productList?message=Product not found&messageType=error');
        }

        // Convert category from string to ObjectId if needed
        let categoryId = category;
        if (typeof category === 'string') {
            const categoryDoc = await Category.findOne({ name: category });
            if (categoryDoc) {
                categoryId = categoryDoc._id;
            } else {
                return res.redirect(`/admin/editProduct/${productId}?message=Category not found&messageType=error`);
            }
        }

        // Update product details
        product.name = name;
        product.description = description;
        product.price = price;
        product.brand = brand;
        product.category = categoryId; // Assign the ObjectId here
        product.stock = stock; // Update stock

        if (images.length > 0) {
            product.images = images.slice(0, 3); // Only update images if new ones are uploaded
        }

        await product.save();

        res.redirect('/admin/productList');
    } catch (error) {
        console.error(error.message);
        res.redirect(`/admin/editProduct/${req.params.id}?message=Internal Server Error&messageType=error`);
    }
};


// Delete product
const Admin_deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/productList');
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};


// Category Management
const getCategoryPage = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('catagoryManagement', { categories });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};


// List Users
const Admin_userList = async (req, res) => {
    try {
        // Get page number from query parameters, default to 1 if not provided
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Number of users per page

        // Get the total number of users
        const totalUsers = await User.countDocuments();
        
        // Calculate total pages
        const totalPages = Math.ceil(totalUsers / limit);

        // Fetch users for the current page
        const users = await User.find()
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('userManagement', {
            users,
            currentPage: page,
            totalPages,
            limit,
            message: null,
            messageType: null
        });
    } catch (error) {
        console.error('Error fetching users:', error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};




// Block/Unblock User
const Admin_toggleBlockUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            console.log('User not found:', req.params.id); // Debugging line
            return res.status(404).send('User not found');
        }

        console.log('User before toggling block status:', user); // Debugging line
        user.isBlocked = !user.isBlocked;
        await user.save();
        console.log('User after toggling block status:', user); // Debugging line
        res.redirect('/admin/userManagement');
    } catch (error) {
        console.log('Error toggling block status:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const newCategory = new Category({ name, description });
        await newCategory.save();
        res.redirect('/admin/catagories/catagoryManagement');
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const editCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        await Category.findByIdAndUpdate(id, { name, description });
        res.redirect('/admin/catagories/catagoryManagement');
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        await Category.findByIdAndDelete(id);
        res.redirect('/admin/catagories/catagoryManagement');
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const getOrderManagementPage = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId', 'username addresses') // Fetch both username and addresses
            .populate('products.productId')
            .sort({ createdAt: -1 });

        const ordersWithDetails = orders.map(order => {
            const userAddress = order.userId.addresses.find(addr => addr._id.equals(order.shippingAddressId));
            return {
                ...order.toObject(),
                shippingAddress: userAddress ? `${userAddress.address1}, ${userAddress.city}` : 'N/A'
            };
        });

        res.render('orderManagement', { orders: ordersWithDetails });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};



  // Delete order function
  const deleteOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        await Order.findByIdAndDelete(orderId);

        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const previousStatus = order.status;
        order.status = status;
        await order.save();

        // If the status is changed from 'Cancelled' or 'Returned' to any other status, deduct the refunded amount from the wallet
        if (['Cancelled', 'Returned'].includes(previousStatus) && !['Cancelled', 'Returned'].includes(status)) {
            let wallet = await Wallet.findOne({ user: order.userId });
            if (wallet && wallet.balance >= order.totalPrice) {
                wallet.balance -= order.totalPrice;
                wallet.transactions.push({
                    amount: -order.totalPrice,
                    type: 'debit',
                    description: `Order status updated, refund revoked (Order ID: ${order._id})`
                });

                await wallet.save();
            } else {
                return res.status(400).json({ message: 'Insufficient wallet balance to revoke refund.' });
            }
        }

        res.json({ message: 'Order status updated and wallet adjusted if necessary.' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Failed to update order status.' });
    }
};

const approveReturn = async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order || !order.returnRequested) {
            return res.status(400).json({ success: false, message: 'No return request found for this order.' });
        }

        // Update the order status to 'Returned'
        order.status = 'Returned';
        order.returnRequested = false;
        await order.save();

        // Process refund to wallet, regardless of payment method (COD, Razorpay, or Wallet)
        let wallet = await Wallet.findOne({ user: order.userId });
        if (!wallet) {
            wallet = new Wallet({ user: order.userId, balance: 0, transactions: [] });
        }

        wallet.balance += order.totalPrice;  // Add the refunded amount to the wallet
        wallet.transactions.push({
            amount: order.totalPrice,
            type: 'credit',
            description: `Order returned and refunded (Order ID: ${order._id})`
        });

        await wallet.save();

        res.json({ success: true, message: 'Return approved and amount refunded to wallet.' });
    } catch (error) {
        console.error('Error approving return:', error);
        res.status(500).json({ success: false, message: 'Failed to approve return.' });
    }
};


// View order details function
const viewOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Fetch order details with populated user and product data
        const order = await Order.findById(orderId)
            .populate('userId') // Populate user details
            .populate({
                path: 'products.productId', // Populate product details
                select: 'name image' // Select the fields you need
            })
            .exec();

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Extract shipping address from user's addresses if needed
        const shippingAddress = order.userId.addresses.id(order.shippingAddressId) || {};

        // Prepare the response object with additional details
        const response = {
            _id: order._id,
            userId: order.userId ? order.userId.username : 'N/A',
            shippingAddress: {
                firstName: shippingAddress.firstName || 'N/A',
                lastName: shippingAddress.lastName || 'N/A',
                address1: shippingAddress.address1 || 'N/A',
                city: shippingAddress.city || 'N/A',
                state: shippingAddress.state || 'N/A',
                zip: shippingAddress.zip || 'N/A'
            },
            totalPrice: order.totalPrice || 'N/A',
            status: order.status || 'N/A',
            products: order.products.map(product => ({
                ...product._doc,
                productId: {
                    ...product.productId._doc,
                    image: product.productId.image || 'default-image.jpg' // Fallback image
                }
            }))
        };

        // Send formatted order details as JSON
        res.json(response);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


const getAddCouponPage = async (req, res) => {
    try {
        // Set your message and messageType based on your logic
        const message = 'Your message here';
        const messageType = 'success'; // or 'error' based on your logic

        res.render('addCoupen', { message, messageType });
    } catch (error) {
        console.error(error.message);
    }
};

const addCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, expirationDate, usageLimit, minPrice } = req.body;

        const maxDiscountValue = 100; // Set maximum discount limit

        if (discountValue > maxDiscountValue) {
            return res.redirect('/admin/addCouponPage?message=Discount exceeds maximum allowed value.&messageType=error');
        }

        const newCoupon = new Coupon({
            code,
            discountType,
            discountValue,
            expirationDate,
            usageLimit: usageLimit || 1,
            minPrice
        });

        await newCoupon.save();
        res.redirect('/admin/couponList?message=Coupon added successfully!&messageType=success');
    } catch (error) {
        console.error('Error adding coupon:', error.message);
        res.redirect('/admin/addCouponPage?message=Error adding coupon.&messageType=error');
    }
};

const getCouponList = async (req, res) => {
    try {
        // Set default values for page and limit
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5; // Show 10 coupons per page by default

        // Calculate total coupons and the number of pages
        const totalCoupons = await Coupon.countDocuments({});
        const totalPages = Math.ceil(totalCoupons / limit);

        // Fetch the coupons for the current page
        const coupons = await Coupon.find({})
            .skip((page - 1) * limit)  // Skip the previous pages
            .limit(limit);  // Limit the number of results

        // Get optional message and messageType from query params
        const { message, messageType } = req.query;

        // Render the coupon list view with pagination info
        res.render('coupenList', {
            coupons,
            message,
            messageType,
            currentPage: page,
            totalPages,
            limit
        });
    } catch (error) {
        res.render('coupenList', { coupons: [], message: 'Error fetching coupons.', messageType: 'error' });
    }
};

const getEditCouponPage = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        const { message, messageType } = req.query; // Get message and type from query params
        res.render('editCoupen', { coupon, message, messageType });
    } catch (error) {
        res.redirect('/admin/couponList?message=Error fetching coupon details.&messageType=error');
    }
};

const editCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, expirationDate, usageLimit, minPrice } = req.body;

        const maxDiscountValue = 100; // Set maximum discount limit

        if (discountValue > maxDiscountValue) {
            return res.redirect(`/admin/editCoupon/${req.params.id}?message=Discount exceeds maximum allowed value.&messageType=error`);
        }

        await Coupon.findByIdAndUpdate(req.params.id, {
            code,
            discountType,
            discountValue,
            expirationDate,
            usageLimit,
            minPrice
        });

        res.redirect(`/admin/couponList?message=Coupon updated successfully!&messageType=success`);
    } catch (error) {
        console.error('Error updating coupon:', error.message);
        res.redirect(`/admin/editCoupon/${req.params.id}?message=Error updating coupon.&messageType=error`);
    }
};


const deleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);

        // Redirect with success message
        res.redirect('/admin/couponList?message=Coupon deleted successfully!&messageType=success');
    } catch (error) {
        console.error('Error deleting coupon:', error.message);

        // Redirect with error message
        res.redirect('/admin/couponList?message=Error deleting coupon.&messageType=error');
    }
};

// Add Offer to a Product or Category
const addOffer = async (req, res) => {
    try {
      const { offerName, offerType, discountType, discountValue, applicableIds, usageLimit, startDate, endDate } = req.body;
  
      console.log('Offer Data:', { offerName, offerType, discountType, discountValue, applicableIds, usageLimit, startDate, endDate });
  
      // Convert applicableIds to an array if it's not already
      let applicableIdsArray = Array.isArray(applicableIds) ? applicableIds : [applicableIds];
  
      // Check if applicableIdsArray is valid
      if (!applicableIdsArray || applicableIdsArray.length === 0) {
        return res.status(400).send('You must apply the offer to at least one product or category.');
      }
  
      const newOffer = new Offer({
        offerName,
        offerType,
        discountType,
        discountValue,
        usageLimit,
        startDate,
        endDate,
        isActive: true
      });
  
      // Assign applicable products or categories based on offerType
      if (offerType === 'product') {
        newOffer.applicableProducts = applicableIdsArray;
      } else if (offerType === 'category') {
        newOffer.applicableCategories = applicableIdsArray;
      }
  
      // Save the new offer
      await newOffer.save();
  
      res.redirect('/admin/offersList');
    } catch (error) {
      console.error('Error creating offer:', error);
      res.status(500).send('Error creating offer');
    }
  };
  
  // Get Offers for Products and Categories
const getOffers = async (req, res) => {
    try {
      // Set default values for page and limit
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5; // Show 10 coupons per page by default

      // Calculate total coupons and the number of pages
      const totalOffers = await Coupon.countDocuments({});
      const totalPages = Math.ceil(totalOffers / limit);

      // Fetch the coupons for the current page
      const offers = await Offer.find({})
          .populate('applicableProducts').populate('applicableCategories')
          .skip((page - 1) * limit)  // Skip the previous pages
          .limit(limit);  // Limit the number of results
          



      //   const offers = await Offer.find().populate('applicableProducts').populate('applicableCategories');
  
      // Pass a message and messageType if they are present in the query parameters
      const { message, messageType } = req.query;
  
      res.render('offerListing', {
         offers,
         message,
         messageType, 
         currentPage: page,
         totalPages,
         limit });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching offers');
    }
  };
  
  const getOfferForEdit = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id)
            .populate('applicableProducts')
            .populate('applicableCategories');

        if (!offer) {
            return res.status(404).send('Offer not found');
        }

        // Fetch products and categories for the form
        const products = await Product.find();
        const categories = await Category.find();

        res.render('editOffer', { offer, products, categories });
    } catch (error) {
        console.error('Error fetching offer for edit:', error);
        res.status(500).send('Error fetching offer for edit');
    }
};

const editOffer = async (req, res) => {
    try {
        const { offerName, offerType, discountType, discountValue, applicableIds, usageLimit, startDate, endDate } = req.body;

        // Convert applicableIds to an array if it's not already
        let applicableIdsArray = Array.isArray(applicableIds) ? applicableIds : [applicableIds];

        const updatedOffer = {
            offerName,
            offerType,
            discountType,
            discountValue,
            usageLimit,
            startDate,
            endDate
        };

        // Assign applicable products or categories based on offerType
        if (offerType === 'product') {
            updatedOffer.applicableProducts = applicableIdsArray;
            updatedOffer.applicableCategories = [];
        } else if (offerType === 'category') {
            updatedOffer.applicableCategories = applicableIdsArray;
            updatedOffer.applicableProducts = [];
        }

        // Update the offer
        await Offer.findByIdAndUpdate(req.params.id, updatedOffer);

        res.redirect('/admin/offersList');
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).send('Error updating offer');
    }
};

// Delete Offer
  const deleteOffer = async (req, res) => {
    try {
      await Offer.findByIdAndDelete(req.params.offerId);
      res.redirect('/admin/offersList');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error deleting offer');
    }
  };

  const addOfferPage = async (req, res) => {
    try {
        const products = await Product.find(); // Fetch products for selection
        const categories = await Category.find(); // Fetch categories for selection

        res.render('addOffer', { products, categories, offer: null, message: null, messageType: null });
    } catch (error) {
        console.error('Error fetching products and categories:', error.message);
        res.render('admin/addOffer', { products: [], categories: [], offer: null, message: 'An error occurred.', messageType: 'error' });
    }
};

const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Set start and end times for the date range
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Match criteria to filter delivered orders within the date range
        const matchCriteria = {
            status: 'Delivered',
            createdAt: { $gte: start, $lte: end }
        };

        // Get the sales data by product
        const salesData = await Order.aggregate([
            { $match: matchCriteria },
            { $unwind: '$products' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products.productId',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: "$productDetails._id",
                    productName: { $first: "$productDetails.name" },
                    categoryName: { $first: "$productDetails.categoryName" }, // Ensure this field exists
                    totalQuantity: { $sum: "$products.quantity" },
                    totalRevenue: {
                        $sum: {
                            $multiply: ["$products.quantity", "$productDetails.price"]
                        }
                    },
                    totalDiscount: { $sum: "$discountAmount" },
                    couponsDeduction: { $sum: "$couponDeduction" }
                }
            }
        ]);

        // Get the overall sales data
        const overallSales = await Order.aggregate([
            { $match: matchCriteria },
            {
                $group: {
                    _id: null,
                    overallSalesCount: { $sum: { $size: "$products" } },
                    overallOrderAmount: { $sum: "$totalPrice" },
                    overallDiscount: { $sum: "$discountAmount" },
                    overallCouponsDeduction: { $sum: "$couponDeduction" }
                }
            }
        ]);

        const overallSalesData = overallSales[0] || { 
            overallSalesCount: 0, 
            overallOrderAmount: 0, 
            overallDiscount: 0, 
            overallCouponsDeduction: 0 
        };

        // Render the sales report page with the sales data and overall stats
        res.render('dashboard', { 
            salesData, 
            overallSalesCount: overallSalesData.overallSalesCount,
            overallOrderAmount: overallSalesData.overallOrderAmount,
            overallDiscount: overallSalesData.overallDiscount,
            overallCouponsDeduction: overallSalesData.overallCouponsDeduction,
            filters: req.query,
            queryString: new URLSearchParams(req.query).toString()
        });
    } catch (err) {
        console.error('Error in getSalesReport:', err);
        res.status(500).send('Server Error');
    }
};

const exportSalesReportCSV = async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        
        // Fetch sales data using same logic as getSalesReport
        const salesData = await fetchSalesData({ startDate, endDate, category });

        const csvWriter = createCsvWriter({
            path: 'sales_report.csv',
            header: [
                { id: 'productName', title: 'Product Name' },
                { id: 'categoryName', title: 'Category' },
                { id: 'totalQuantity', title: 'Total Quantity Sold' },
                { id: 'totalRevenue', title: 'Total Revenue' }
            ]
        });

        // Prepare data for CSV
        const records = salesData.map(item => ({
            productName: item.productName,
            categoryName: item.categoryName,
            totalQuantity: item.totalQuantity,
            totalRevenue: item.totalRevenue.toFixed(2)
        }));

        await csvWriter.writeRecords(records);

        res.download('sales_report.csv', 'sales_report.csv', (err) => {
            if (err) {
                console.error('Error downloading CSV file:', err);
                res.status(500).send('Error downloading file');
            }
        });
    } catch (error) {
        console.error('Error exporting sales report as CSV:', error);
        res.status(500).send('Internal Server Error');
    }
};

const exportSalesReportExcel = async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;

        const salesData = await fetchSalesData({ startDate, endDate, category });

        console.log('Sales Data:', salesData);  // Add this line to debug

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'Category', key: 'categoryName', width: 20 },
            { header: 'Total Quantity Sold', key: 'totalQuantity', width: 20 },
            { header: 'Total Revenue', key: 'totalRevenue', width: 20 }
        ];

        salesData.forEach(item => {
            worksheet.addRow({
                productName: item.productName,
                categoryName: item.categoryName,
                totalQuantity: item.totalQuantity,
                totalRevenue: item.totalRevenue.toFixed(2)
            });
        });

        console.log('Excel Data:', salesData);  // Add this line to debug

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + 'sales_report.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting sales report as Excel:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Helper function to fetch sales data
const fetchSalesData = async ({ startDate, endDate, category }) => {
    let matchCriteria = { status: "Delivered" };

    // Handle date range filtering
    if (startDate && endDate) {
        matchCriteria.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    // Handle category filtering
    if (category) {
        matchCriteria['productDetails.category'] = category;  // Use productDetails.category in match
    }

    try {
        console.log('Match Criteria:', JSON.stringify(matchCriteria, null, 2));  // Debug: Print match criteria

        const salesData = await Order.aggregate([
            { $match: matchCriteria },
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$productDetails._id",
                    productName: { $first: "$productDetails.name" },
                    categoryName: { $first: "$categoryDetails.name" },
                    totalQuantity: { $sum: "$products.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$products.quantity", "$productDetails.price"] } }
                }
            }
        ]);

        console.log('Fetched Sales Data:', JSON.stringify(salesData, null, 2));  // Debug: Print fetched data
        return salesData;
    } catch (err) {
        console.error('Error fetching sales data:', err);
        throw err;
    }
};



module.exports = {
    Admin_login,
    Admin_home,
    Admin_productList,
    Admin_addProductPage,
    Admin_addProduct,
    Admin_editProductPage,
    Admin_editProduct,
    Admin_deleteProduct,
    getCategoryPage,
    Admin_userList,
    Admin_toggleBlockUser,
    addCategory,
    editCategory,
    deleteCategory,
    Admin_loginFunction,
    Admin_logout,
    getOrderManagementPage,
    deleteOrder,
    updateOrderStatus,
    approveReturn,
    viewOrderDetails,
    getAddCouponPage,
    addCoupon,
    getCouponList,
    getEditCouponPage,
    editCoupon,
    deleteCoupon,
    addOffer,
    getOffers,
    deleteOffer,
    getOfferForEdit,
    editOffer,
    addOfferPage,
    getSalesReport,
    exportSalesReportCSV,
    exportSalesReportExcel
};