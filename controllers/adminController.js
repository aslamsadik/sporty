const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Offer = require('../models/offerModel');
const Order = require('../models/orderShema'); // Adjust the path as necessary
const Coupon = require('../models/coupenModel');
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
                totalRevenue: { $sum: { $multiply: ["$products.quantity", "$productDetails.price"] } }
            }
        });

        const salesData = await Order.aggregate(salesDataPipeline);
        const queryString = new URLSearchParams(filters).toString();

        res.render('dashboard', {
            categories,
            filters,
            salesData,
            queryString
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};

// Product Management
const Admin_productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of products per page
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find()
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

        // Check if the category exists
        const validCategory = await Category.findOne({ name: category });
        if (!validCategory) {
            return res.render('productManagement', { 
                message: 'Category does not exist.', 
                messageType: 'error', 
                product: req.body,
                categories: await Category.find()
            });
        }

        if (images.length > 3) {
            return res.render('productManagement', { 
                message: 'You can upload a maximum of 3 images per product.', 
                messageType: 'error', 
                product: req.body,
                categories: await Category.find()
            });
        }

        const newProduct = new Product({ name, description, price, brand, category, stock, images });
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
            .populate('userId', 'username') // Populate the user's username
            .populate('products.productId')
            .populate('shippingAddressId')
            .sort({ createdAt: -1 });

        const ordersWithDetails = orders.map(order => ({
            ...order.toObject(),
            shippingAddress: order.shippingAddressId ? `${order.shippingAddressId.street}, ${order.shippingAddressId.city}` : 'N/A'
        }));

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

  
  // Update order status function
  const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        await Order.findByIdAndUpdate(orderId, { status });

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Failed to update order status' });
    }
};

// View order details function
const viewOrderDetails = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const order = await Order.findById(orderId)
        .populate('userId', 'username')
        .populate('products.productId')
        .populate('shippingAddressId');
        
      const orderDetails = {
        ...order.toObject(),
        shippingAddress: order.shippingAddressId ? `${order.shippingAddressId.street}, ${order.shippingAddressId.city}` : 'N/A'
      };
  
      res.status(200).json(orderDetails);
    } catch (error) {
      console.error('Error fetching order details:', error);
      res.status(500).json({ message: 'Error fetching order details' });
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


// Add Coupon
const addCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, expirationDate, usageLimit, minPrice } = req.body;

        const newCoupon = new Coupon({
            code,
            discountType,
            discountValue,
            expirationDate,
            usageLimit: usageLimit || 1, // Default to 1 if not provided
            minPrice
        });

        await newCoupon.save();
        console.log('Coupon added:', newCoupon);

        res.redirect('/admin/couponList?message=Coupon added successfully!&messageType=success');
    } catch (error) {
        console.error('Error adding coupon:', error.message);
        res.redirect('/admin/addCouponPage?message=Error adding coupon.&messageType=error');
    }
};


const getCouponList = async (req, res) => {
    try {
        const coupons = await Coupon.find({});
        const { message, messageType } = req.query; // Get message and type from query params
        res.render('coupenList', { coupons, message, messageType });
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

// Edit Coupon
const editCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, expirationDate, usageLimit, minPrice } = req.body;

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

const createOffer = async (req, res) => {
    try {
      const { offerName, offerType, discountType, discountValue, startDate, endDate, usageLimit, targetId, referralCode } = req.body;
  
      // Create offer object
      const offer = new Offer({
        offerName,
        offerType,
        discountType,
        discountValue,
        startDate,
        endDate,
        usageLimit: usageLimit || null,
        targetId: offerType !== 'referral' ? targetId : undefined, // Only set targetId if offerType is not 'referral'
        referralCode: offerType === 'referral' ? referralCode : undefined  // Only set referralCode if offerType is 'referral'
      });
      
      await offer.save();
      res.redirect('/admin/offersList');
    } catch (error) {
      console.warn('Error creating offer:', error);
      res.status(500).send('Error creating offer');
    }
  };
   
const updateOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        const updateData = req.body;

        const updatedOffer = await Offer.findByIdAndUpdate(offerId, updateData, { new: true });
        if (!updatedOffer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        res.json({ message: 'Offer updated successfully', offer: updatedOffer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating offer' });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        const deletedOffer = await Offer.findByIdAndDelete(offerId);

        if (!deletedOffer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        res.json({ message: 'Offer deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting offer' });
    }
};

const listOffers = async (req, res) => {
    try {
        // Fetch all offers
        const offers = await Offer.find({});

        // Define message and messageType based on any conditions or set them to null
        const message = req.query.message || null;
        const messageType = req.query.messageType || null;

        res.render('offerListing', { 
            offers, 
            message, 
            messageType 
        });
    } catch (error) {
        console.error('Error listing offers:', error.message);
        res.render('admin/offerListing', { 
            offers: [], 
            message: 'An error occurred while fetching offers.', 
            messageType: 'error' 
        });
    }
};

const editOffers = async (req, res) => {
    try {
        const offerId = req.params.id;

        if (!offerId) {
            // Render the page for adding a new offer
            return res.render('editOffer', { offer: null, message: null });
        }

        const offer = await Offer.findById(offerId);

        if (!offer) {
            // Handle the case where the offer does not exist
            return res.render('editOffer', { offer: null, message: 'Offer not found', messageType: 'error' });
        }

        res.render('editOffer', { offer, message: null });
    } catch (error) {
        console.error('Error fetching offer for edit:', error.message);
        res.render('editOffer', { offer: null, message: 'An error occurred while fetching the offer.', messageType: 'error' });
    }
  };

  const addOfferPage = async (req, res) => {
    try {
        const offerId = req.params.id;

        // Fetch all offers
        const offers = await Offer.find();

        if (!offerId) {
            // Render the page for adding a new offer
            return res.render('addOffer', { offers, offer: null, message: null, messageType: null });
        }

        const offer = await Offer.findById(offerId);

        if (!offer) {
            // Handle the case where the offer does not exist
            return res.render('addOffer', { offers, offer: null, message: 'Offer not found', messageType: 'error' });
        }

        res.render('addOffer', { offers, offer: null, message: null, messageType: null });
    } catch (error) {
        console.error('Error fetching offer for edit:', error.message);
        res.render('addOffer', { offers: [], offer: null, message: 'An error occurred while fetching the offer.', messageType: 'error' });
    }
};

// Display Sales Report with Filters
// const getSalesReport = async (req, res) => {
//     try {
//         const { startDate, endDate, category } = req.query;
//         const categories = await Category.find({});
        
//         // Define match criteria for filtering
//         const matchCriteria = {
//             status: 'Delivered',
//             createdAt: {
//                 $gte: new Date(startDate),
//                 $lte: new Date(endDate)
//             }
//         };

//         if (category) {
//             matchCriteria['products.productId'] = mongoose.Types.ObjectId(category);
//         }

//         // Aggregate sales data
//         const salesData = await Order.aggregate([
//             { $unwind: '$products' },
//             {
//                 $lookup: {
//                     from: 'products',
//                     localField: 'products.productId',
//                     foreignField: '_id',
//                     as: 'productDetails'
//                 }
//             },
//             { $unwind: '$productDetails' },
//             {
//                 $lookup: {
//                     from: 'categories',
//                     localField: 'productDetails.category',
//                     foreignField: '_id',
//                     as: 'categoryDetails'
//                 }
//             },
//             { $unwind: '$categoryDetails' },
//             { $match: matchCriteria },
//             {
//                 $group: {
//                     _id: '$productDetails._id',
//                     productName: { $first: '$productDetails.name' },
//                     category: { $first: '$categoryDetails.name' },
//                     totalQuantity: { $sum: '$products.quantity' },
//                     totalRevenue: { $sum: { $multiply: ['$products.quantity', '$productDetails.price'] } }
//                 }
//             }
//         ]);

//         // Render the results
//         res.render('dashboard', { 
//             salesData, 
//             filters: req.query, 
//             categories: categories,
//             queryString: new URLSearchParams(req.query).toString() // Pass the query string for export links
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Server Error');
//     }
// };

const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        const categories = await Category.find({});

        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);
        console.log('Category:', category);

        const matchCriteria = {
            status: 'Delivered',
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        // Check and log the category
        if (category) {
            try {
                // Ensure category is valid
                console.log('Converting category:', category);
                matchCriteria['products.category'] = mongoose.Types.ObjectId(category);
            } catch (err) {
                console.error('Error converting category:', err);
            }
        }

        console.log('Match Criteria:', matchCriteria);

        const salesData = await Order.aggregate([
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
                $lookup: {
                    from: 'categories',
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: '$categoryDetails' },
            { $match: matchCriteria },
            {
                $group: {
                    _id: '$productDetails._id',
                    productName: { $first: '$productDetails.name' },
                    category: { $first: '$categoryDetails.name' },
                    totalQuantity: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$products.quantity', '$productDetails.price'] } }
                }
            }
        ]);

        console.log('Sales Data:', salesData);

        res.render('dashboard', { 
            salesData, 
            filters: req.query, 
            categories: categories,
            queryString: new URLSearchParams(req.query).toString() // Pass the query string for export links
        });
    } catch (err) {
        console.error('Error in getSalesReport:', err);
        res.status(500).send('Server Error');
    }
};


// Export Sales Report as CSV
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


// Export Sales Report as Excel
const exportSalesReportExcel = async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;

        // Fetch sales data using same logic as getSalesReport
        const salesData = await fetchSalesData({ startDate, endDate, category });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Define columns
        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'Category', key: 'categoryName', width: 20 },
            { header: 'Total Quantity Sold', key: 'totalQuantity', width: 20 },
            { header: 'Total Revenue', key: 'totalRevenue', width: 20 }
        ];

        // Add rows
        salesData.forEach(item => {
            worksheet.addRow({
                productName: item.productName,
                categoryName: item.categoryName,
                totalQuantity: item.totalQuantity,
                totalRevenue: item.totalRevenue.toFixed(2)
            });
        });

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + 'sales_report.xlsx'
        );

        // Write workbook to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting sales report as Excel:', error);
        res.status(500).send('Internal Server Error');
    }
};


// Helper function to fetch sales data
const fetchSalesData = async ({ startDate, endDate, category }) => {
    let matchCriteria = { status: "Completed" };

    if (startDate && endDate) {
        matchCriteria.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    if (category) {
        matchCriteria['products.category'] = category;
    }

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

    return salesData;
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
    viewOrderDetails,
    getAddCouponPage,
    addCoupon,
    getCouponList,
    getEditCouponPage,
    editCoupon,
    deleteCoupon,
    createOffer,
    updateOffer,
    deleteOffer,
    listOffers,
    editOffers,
    addOfferPage,
    getSalesReport,
    exportSalesReportCSV,
    exportSalesReportExcel
};