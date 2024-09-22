
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
const PDFDocument = require('pdfkit');
const fs = require('fs');



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

const Admin_productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find()
            .populate('category', 'name')  // Only populate the name field of the category
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
        const { message, messageType } = req.query;  // Extract query params

        return res.render('productManagement', {
            message,
            messageType,
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
        const images = req.body.images || []; // Use processed images from middleware
        
        //check if product already exist
        const existingProducts=await Product.findOne({name:name});
        if(existingProducts){
            return res.redirect('/admin/productManagement?message=Product already exists&messageType=error');
        }
        // Find the selected category by its ID
        const selectedCategory = await Category.findById(category);

        if (!selectedCategory) {
            return res.redirect('/admin/productManagement?message=Category not found&messageType=error');
        }

        // Create a new product
        const newProduct = new Product({
            name,
            description,
            price,
            brand,
            category: selectedCategory._id,  // Save category as ObjectId
            stock,
            images
        });

        await newProduct.save();

        res.redirect('/admin/productList');  // Redirect to product list page
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
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

const Admin_editProduct = async (req, res) => {
    try {
        const { name, description, brand, price, stock, category } = req.body;
        const productId = req.params.id;

        // Fetch the existing product
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Update product fields
        product.name = name;
        product.description = description;
        product.brand = brand;
        product.price = price;
        product.stock = stock;
        product.category = category;

        // If new images are uploaded, update the product's images field
        if (req.body.images && req.body.images.length > 0) {
            product.images = req.body.images;
        }

        // Save the updated product
        await product.save();

        // res.redirect(`/admin/editProduct/${productId}`); // Redirect after saving
        res.redirect('/admin/productList');
    } catch (error) {
        console.error('Error editing product:', error);
        res.status(500).send('Internal Server Error');
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
        const { message, messageType } = req.query;  // Extract query params
        res.render('catagoryManagement', { categories,message,messageType});
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        // Check if the category already exists
        const existingCategory = await Category.findOne({ name: name });
        if (existingCategory) {
            // Redirect with an error message if the category already exists and return to stop further execution
            return res.redirect('/admin/catagories/catagoryManagement?message=Category already exists&messageType=error');
        }

        // If the category does not exist, create a new one
        const newCategory = new Category({ name, description });
        await newCategory.save();

        // Redirect to the category management page after successful creation
        res.redirect('/admin/catagories/catagoryManagement?message=Category added successfully&messageType=success');
    } catch (error) {
        // Log the error and send a 500 response
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

// const exportSalesReportPDF = async (req, res) => {
//     try {
//         const { startDate, endDate } = req.query;
//         const salesData = await fetchSalesData({ startDate, endDate });

//         // Create a new PDF document
//         const doc = new PDFDocument({ margin: 30 });

//         // Pipe the PDF into a writable stream
//         const filePath = 'sales_report.pdf';
//         const stream = fs.createWriteStream(filePath);
//         doc.pipe(stream);

//         // Add Title to PDF
//         doc.fontSize(10).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
//         doc.moveDown(2);

//         // Draw table headers
//         doc.fontSize(10)
//             .font('Helvetica-Bold')
//             .text('Product Name', 30, doc.y, { width: 100, continued: true })
//             .text('Total Quantity', 150, doc.y, { width: 100, align: 'center', continued: true })
//             .text('Total Revenue (INR)', 330, doc.y, { width: 100, align: 'center', continued: true })
//             .text('Discount (INR)', 430, doc.y, { width: 100, align: 'center', continued: true })
//             .text('Coupons Deduction (INR)', 530, doc.y, { width: 100, align: 'center' });

//         doc.moveDown();

//         // Table content (rows)
//         salesData.forEach(item => {
//             doc.font('Helvetica')
//                 .text(item.productName, 30, doc.y, { width: 200, continued: true })
//                 .text(item.totalQuantity, 230, doc.y, { width: 100, align: 'center', continued: true });

//             const totalRevenue = item.totalRevenue ? item.totalRevenue.toFixed(2) : '0.00';
//             const totalDiscount = item.totalDiscount ? item.totalDiscount.toFixed(2) : '0.00';
//             const couponsDeduction = item.couponsDeduction ? item.couponsDeduction.toFixed(2) : '0.00';

//             doc.text(totalRevenue, 330, doc.y, { width: 100, align: 'center', continued: true })
//                 .text(totalDiscount, 430, doc.y, { width: 100, align: 'center', continued: true })
//                 .text(couponsDeduction, 530, doc.y, { width: 100, align: 'center' });

//             doc.moveDown(1);  // Move down slightly between rows
//             doc.lineWidth(0.5).moveTo(30, doc.y).lineTo(630, doc.y).stroke();  // Draw line after each row
//         });

//         // Close the PDF and finish writing
//         doc.end();

//         // Download the PDF
//         stream.on('finish', function () {
//             res.download(filePath, 'sales_report.pdf', (err) => {
//                 if (err) {
//                     console.error('Error downloading PDF file:', err);
//                     res.status(500).send('Error downloading file');
//                 }
//                 // Optionally, delete the file after download
//                 fs.unlinkSync(filePath);
//             });
//         });
//     } catch (error) {
//         console.error('Error exporting sales report as PDF:', error);
//         res.status(500).send('Internal Server Error');
//     }
// };

const exportSalesReportPDF = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const salesData = await fetchSalesData({ startDate, endDate });

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 30 });

        // Pipe the PDF into a writable stream
        const filePath = 'sales_report.pdf';
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Add Title to PDF
        doc.fontSize(16).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
        doc.moveDown(2);

        // Define column positions and widths
        const columnPositions = {
            productName: 30,
            totalQuantity: 200,
            totalRevenue: 300,
            totalDiscount: 400,
            couponsDeduction: 500
        };

        const columnWidths = {
            productName: 170,
            totalQuantity: 100,
            totalRevenue: 100,
            totalDiscount: 100,
            couponsDeduction: 100
        };

        // Draw table headers
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Product Name', columnPositions.productName, doc.y, { width: columnWidths.productName })
            .text('Total Quantity', columnPositions.totalQuantity, doc.y, { width: columnWidths.totalQuantity, align: 'center' })
            .text('Total Revenue (INR)', columnPositions.totalRevenue, doc.y, { width: columnWidths.totalRevenue, align: 'center' })
            .text('Discount (INR)', columnPositions.totalDiscount, doc.y, { width: columnWidths.totalDiscount, align: 'center' })
            .text('Coupons Deduction (INR)', columnPositions.couponsDeduction, doc.y, { width: columnWidths.couponsDeduction, align: 'center' });

        doc.moveDown();

        // Draw a line after the headers
        doc.lineWidth(0.5).moveTo(30, doc.y).lineTo(630, doc.y).stroke();

        // Table content (rows)
        salesData.forEach(item => {
            // Prepare data formatting
            const totalRevenue = item.totalRevenue ? item.totalRevenue.toFixed(2) : '0.00';
            const totalDiscount = item.totalDiscount ? item.totalDiscount.toFixed(2) : '0.00';
            const couponsDeduction = item.couponsDeduction ? item.couponsDeduction.toFixed(2) : '0.00';

            // Insert row data under the respective headers
            doc.font('Helvetica')
                .text(item.productName, columnPositions.productName, doc.y, { width: columnWidths.productName })
                .text(item.totalQuantity, columnPositions.totalQuantity, doc.y, { width: columnWidths.totalQuantity, align: 'center' })
                .text(totalRevenue, columnPositions.totalRevenue, doc.y, { width: columnWidths.totalRevenue, align: 'center' })
                .text(totalDiscount, columnPositions.totalDiscount, doc.y, { width: columnWidths.totalDiscount, align: 'center' })
                .text(couponsDeduction, columnPositions.couponsDeduction, doc.y, { width: columnWidths.couponsDeduction, align: 'center' });

            // Move down slightly between rows
            doc.moveDown(1);

            // Draw a line after each row for clarity
            doc.lineWidth(0.5).moveTo(30, doc.y).lineTo(630, doc.y).stroke();
        });

        // Close the PDF and finish writing
        doc.end();

        // Download the PDF once it's written
        stream.on('finish', function () {
            res.download(filePath, 'sales_report.pdf', (err) => {
                if (err) {
                    console.error('Error downloading PDF file:', err);
                    res.status(500).send('Error downloading file');
                }
                // Optionally, delete the file after download
                fs.unlinkSync(filePath);
            });
        });
    } catch (error) {
        console.error('Error exporting sales report as PDF:', error);
        res.status(500).send('Internal Server Error');
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
    exportSalesReportExcel,
    exportSalesReportPDF 
};