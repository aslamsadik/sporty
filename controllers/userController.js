const mongoose = require('mongoose');
const Razorpay = require('razorpay'); // Ensure this is imported at the top
const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Category = require('../models/categoryModel');  // Ensure Category is imported
const Order = require('../models/orderShema');
const Offer = require('../models/offerModel');
const Coupon = require('../models/coupenModel');
const Wishlist = require('../models/wishlistModel');
const Wallet = require('../models/walletModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { ObjectId } = require('mongodb'); // Import ObjectId


// Helper function to generate a numeric OTP
const generateNumericOtp = (length) => {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10); // Append a random digit (0-9)
    }
    return otp;
};

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const signUpPage = async (req, res) => {
    try {
        return res.render('signupage', { message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const loginPage = async (req, res) => {
    try {
        return res.render('login', { message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const logout = async (req, res) => {
    try {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err.message);
                return res.status(500).send('Internal Server Error');
            }
            // Redirect to the login page after logout
            res.redirect('/login');
        });
    } catch (error) {
        console.error('Error logging out:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const HomePage = async (req, res) => {
    try {
        const query = req.query.q; // Get the search query from the URL

        let products;

        if (query) {
            // If there's a search query, filter products by name
            products = await Product.find({ name: new RegExp(query, 'i') });
        } else {
            // If no search query, fetch all products
            products = await Product.find();
        }

        const  offers= await Offer.find({ endDate: { $gte: new Date() } }); // Get only valid offers
        return res.render('home', { products,offers, message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};


const searchProducts = async (query) => {
    try {
    
        const results = await Product.find({ name: { $regex: query, $options: 'i' } }); // Case-insensitive search
        console.log('Search results:', results); // Log the search results
        return results;
    } catch (error) {
        console.error('Error searching products:', error);
        throw error;
    }
};

const search = async (req, res) => {
    try {
        // Get the search query and category from the request
        const { search, category } = req.query;

        // Build the query object
        let query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' }; // Search by product name (case-insensitive)
        }
        if (category) {
            query.category = category; // Filter by category if provided
        }

        // Fetch the products based on the query
        const products = await Product.find(query);

        // Render the home.ejs template with the fetched products
        res.render('home', { products });
    } catch (error) {
        console.error('Error fetching search results:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getShopPage = async (req, res) => {
    try {
        const { page = 1, sort = 'price', minPrice, maxPrice, categories = [], brands = [] } = req.query;
        const ITEMS_PER_PAGE = 9;

        // Convert categories and brands to arrays if they are not already
        const categoryArray = Array.isArray(categories) ? categories : [categories];
        const brandArray = Array.isArray(brands) ? brands : [brands];

        // Create filter object
        let filter = {};

        // Apply price filter only if minPrice and maxPrice are provided
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = minPrice;
            if (maxPrice) filter.price.$lte = maxPrice;
        }

        // Apply category filter only if categories are selected
        if (categoryArray.length > 0 && categoryArray[0] !== '') {
            filter.category = { $in: categoryArray };
        }

        // Apply brand filter only if brands are selected
        if (brandArray.length > 0 && brandArray[0] !== '') {
            filter.brand = { $in: brandArray };
        }

        // Count total products
        const totalProducts = await Product.countDocuments(filter);

        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);

        // Fetch products with sorting, filtering, and pagination, and populate the category field
        const products = await Product.find(filter)
            .sort({ price: sort === 'price' ? 1 : -1 })
            .skip((page - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .populate('category', 'name'); // Populate category field with the name

        // Fetch distinct categories and brands for filters
        const categoriesList = await Category.find({}, 'name'); // Fetch all category names
        const brandsList = await Product.distinct('brand');

        res.render('shop', {
            products,
            categories: categoriesList,
            brands: brandsList,
            totalProducts,
            totalPages,
            currentPage: parseInt(page),
            sort,
            minPrice: minPrice || 0,
            maxPrice: maxPrice || '',
            selectedCategories: categoryArray,
            selectedBrands: brandArray
        });
    } catch (error) {
        console.error('Error fetching shop page:', error);
        res.status(500).send('Internal Server Error');
    }
};


// Fetch and render product description page
const getProductDescriptionPage = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category');
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Find applicable offers for the product or its category
        const offers = await Offer.find({
            $or: [
                { offerType: 'product', targetId: product._id },
                { offerType: 'category', targetId: product.category._id }
            ],
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        res.render('shopdetails', { product, offers });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};


// const getProductDescriptionPage = async (req, res) => {
//     try {
//         const productId = mongoose.Types.ObjectId(req.params.id);

//         // Fetch the product along with its category
//         const product = await Product.findById(productId).populate('category').exec();

//         if (!product) {
//             return res.status(404).send('Product not found');
//         }

//         // Fetch offers related to the product or category
//         const offers = await Offer.find({
//             $or: [
//                 { applicableProducts: product._id },  // Directly compare ObjectId
//                 { applicableCategories: product.category._id }  // Directly compare ObjectId
//             ]
//         });

//         console.log('Product ID:', product._id);
//         console.log('Category ID:', product.category._id);
//         console.log('Offers found:', offers);

//         res.render('shopdetails', {
//             product,
//             offers // Pass offers to the view
//         });
//     } catch (error) {
//         console.error('Error fetching product details:', error);
//         res.status(500).send('Server Error');
//     }
// };

const signUp = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Input validation
        if (!username || !email || !password || !confirmPassword) {
            return res.render('signupage', { message: 'All fields are required', messageType: 'error' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('signupage', { message: 'Invalid email format', messageType: 'error' });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.render('signupage', { message: 'Passwords do not match', messageType: 'error' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('signupage', { message: 'User already exists', messageType: 'error' });
        }

        // Generate numeric OTP
        const otpCode = generateNumericOtp(6);
        const hashedOtp = await bcrypt.hash(otpCode, 10); // Hash the OTP

        // Save user info to session
        req.session.signupData = { username, email, password: await bcrypt.hash(password, 10) };

        // Save OTP to the database
        await Otp.create({ email, otp: hashedOtp });

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'OTP for Sign-Up',
            text: `Your OTP code is ${otpCode}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending OTP email:', error);
                return res.render('signupage', { message: 'Error sending OTP email', messageType: 'error' });
            }
            console.log('OTP email sent:', info.response);
            // Render OTP page with a success message
            res.render('otp_page', { email, message: 'An OTP has been sent to your email. Please check your inbox.', messageType: 'success' });
        });
    } catch (error) {
        console.error('Error during sign-up process:', error.message);
        res.render('signupage', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email) {
            return res.render('otp_page', {
                email: '',
                message: 'Email is required',
                messageType: 'error'
            });
        }

        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
            console.error('No OTP record found for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Invalid or expired OTP',
                messageType: 'error'
            });
        }

        console.log(`Stored OTP: ${otpRecord.otp}, Received OTP: ${otp.trim()}`);

        const isMatch = await bcrypt.compare(otp.trim(), otpRecord.otp);
        if (!isMatch) {
            console.error('OTP mismatch for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Invalid or expired OTP',
                messageType: 'error'
            });
        }

        // Check if OTP is expired
        const now = new Date();
        const otpAge = (now - otpRecord.createdAt) / 1000; // Age in seconds
        console.log(`OTP age for email ${email}: ${otpAge} seconds`);
        if (otpAge > 30) { // 30 seconds TTL
            console.error('OTP expired for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Invalid or expired OTP',
                messageType: 'error'
            });
        }

        // Retrieve signup data from session
        const { username, password } = req.session.signupData || {};

        if (!username || !password) {
            console.error('Signup data missing from session for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Signup data is missing. Please sign up again.',
                messageType: 'error'
            });
        }

        // Save the new user to the database
        const newUser = new User({ username, email, password, isVerified: true, isBlocked: false });
        await newUser.save();

        // Delete the OTP record from the database
        await Otp.deleteOne({ email });

        // Clear signup data from session
        req.session.signupData = null;

        // Redirect to login page with success message
        res.redirect('/login');
    } catch (error) {
        console.error('Error during OTP verification:', error.message);
        res.render('otp_page', {
            email: req.body.email || '', // Ensure email is passed even in case of error
            message: 'Internal Server Error',
            messageType: 'error'
        });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const otpCode = generateNumericOtp(6);
        const hashedOtp = await bcrypt.hash(otpCode, 10);

        await Otp.findOneAndUpdate(
            { email },
            { otp: hashedOtp, createdAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Resend OTP for Sign-Up',
            text: `Your new OTP code is ${otpCode}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending OTP email:', error);
                return res.status(500).json({ success: false, message: 'Error sending OTP email' });
            }
            console.log('OTP email sent: ', info.response);
            res.status(200).json({ success: true, message: 'A new OTP has been sent to your email.' });
        });
    } catch (error) {
        console.error('Error during OTP resending process:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.render('login', { message: 'Email and password are required', messageType: 'error' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('login', { message: 'Invalid email format', messageType: 'error' });
        }

        // Find the user by email
        const user = await User.findOne({ email });

        if (!user || !user.isVerified) {
            return res.render('login', { message: 'Invalid email or password', messageType: 'error' });
        } else if (user.isBlocked) {
            return res.render('login', { message: 'Account is blocked', messageType: 'error' });
        }

        // Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { message: 'Invalid email or password', messageType: 'error' });
        }

        // Store user data in session
        req.session.user = { 
            userId: user._id, 
            email: user.email, 
            username: user.username,
            isAdmin: user.isAdmin,
            isBlocked: user.isBlocked
        };

        console.log('User session data set:', req.session.user);

        // Redirect to home page
        res.redirect('/');
    } catch (error) {
        console.log(error.message);
        res.render('login', { message: 'Internal Server Error', messageType: 'error' });
    }
};

// Get Cart
const getCart = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const page = parseInt(req.query.page, 10) || 1; // Current page
        const limit = 5; // Items per page
        const skip = (page - 1) * limit; // Items to skip

        let cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart) {
            cart = { products: [], totalPrice: 0 };
        }

        // Paginate products
        const paginatedProducts = cart.products.slice(skip, skip + limit);
        const totalItems = cart.products.length;
        const totalPages = Math.ceil(totalItems / limit);

        cart.totalPrice = parseFloat(cart.totalPrice.toFixed(2));

        res.render('cart', {
            cart: {
                products: paginatedProducts,
                totalQuantity: totalItems,
                totalPrice: cart.totalPrice,
                totalPages,
                currentPage: page
            }
        });
    } catch (error) {
        console.error('Error getting cart:', error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const addToCart = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const productId = req.body.productId;
        const quantity = parseInt(req.body.quantity, 10) || 1;

        // Fetch the product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ success: false, message: 'Not enough stock available' });
        }

        // Check if the price is a valid number
        if (isNaN(product.price)) {
            console.error(`Invalid price for product: ${product.name}`);
            return res.status(500).json({ success: false, message: 'Invalid product price' });
        }

        // Retrieve the user's cart
        let cart = await Cart.findOne({ userId });

        if (cart) {
            const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
            if (productIndex > -1) {
                cart.products[productIndex].quantity += quantity;
            } else {
                cart.products.push({ productId, quantity });
            }
        } else {
            cart = new Cart({ userId, products: [{ productId, quantity }] });
        }

        // Recalculate the total price by populating product details
        cart = await cart.populate('products.productId');

        cart.totalPrice = cart.products.reduce((total, item) => {
            const itemPrice = item.productId.price;
            return total + (itemPrice * item.quantity);
        }, 0);

        await cart.save();

        product.stock -= quantity;
        await product.save();

        res.status(200).json({ success: true, message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding to cart:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const productId = req.body.productId;

        let cart = await Cart.findOne({ userId });

        if (cart) {
            // Filter out the product to remove it from the cart
            cart.products = cart.products.filter(p => p.productId.toString() !== productId);

            // Recalculate total price
            let totalPrice = 0;
            for (const item of cart.products) {
                const product = await Product.findById(item.productId);
                if (product) {
                    totalPrice += product.price * item.quantity;
                }
            }
            cart.totalPrice = totalPrice;

            // Save the updated cart
            await cart.save();
        }

        res.status(200).json({ success: true, message: 'Product removed from cart successfully' });
    } catch (error) {
        console.error('Error removing from cart:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const clearCart = async (req, res) => {
    try {
        const userId = req.session.user.userId;

        // Find the cart for the user
        const cart = await Cart.findOne({ userId });

        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is already empty' });
        }

        // Create an array of product updates
        const productUpdates = cart.products.map(item => {
            const { productId, quantity } = item;
            return Product.findByIdAndUpdate(productId, { $inc: { stock: quantity } });
        });

        // Perform all product stock updates in parallel
        await Promise.all(productUpdates);

        // Clear the cart items and reset the totalPrice
        await Cart.findOneAndUpdate({ userId }, { $set: { products: [], totalPrice: 0 } });

        return res.status(200).json({ success: true, message: 'Cart cleared successfully' });
    } catch (error) {
        console.error('Error clearing the cart:', error.message);
        return res.status(500).json({ success: false, message: 'Error clearing the cart' });
    }
};


// Function to update the cart quantity
const updateCart = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const { productIds, quantities } = req.body;

        // Find the user's cart
        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Loop through product IDs and update their quantities
        for (let i = 0; i < productIds.length; i++) {
            const productId = productIds[i];
            const quantity = quantities[i];

            // Find the product in the cart
            const productIndex = cart.products.findIndex(product => product.productId._id.toString() === productId);
            if (productIndex === -1) {
                return res.status(404).json({ message: `Product with ID ${productId} not found in cart` });
            }

            // Update the quantity
            cart.products[productIndex].quantity = parseInt(quantity);
        }

        // Recalculate total price and total quantity
        cart.totalPrice = cart.products.reduce((acc, product) => acc + product.quantity * product.productId.price, 0);
        cart.totalQuantity = cart.products.reduce((acc, product) => acc + product.quantity, 0);

        await cart.save();
        // res.status(200).json({ message: 'Cart updated successfully', cart });
        res.redirect('/cart', {message:"cart updated sucessfully"},cart)
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// const getCheckoutPage = async (req, res) => {
//     try {
//         const userId = req.session.user?.userId;

//         if (!userId) {
//             return res.redirect('/login');
//         }

//         // Fetch cart, user, and wallet information
//         const cart = await Cart.findOne({ userId }).populate('products.productId');
//         const user = await User.findById(userId);
//         const wallet = await Wallet.findOne({ user: userId }); // Make sure the wallet is fetched by `user`, not `userId`

//         if (!cart || cart.products.length === 0) {
//             return res.render('checkout', { 
//                 message: 'Your cart is empty', 
//                 messageType: 'error', 
//                 cart: null, 
//                 user, 
//                 coupons: [], 
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                 razorpayOrderId: null,
//                 cartTotal: 0,
//                 discountAmount: 0,
//                 finalAmount: 0,
//                 appliedCouponCode: null,
//                 walletBalance: wallet?.balance || 0 // Wallet balance defaults to 0 if no wallet is found
//             });
//         }

//         // Calculate cart total
//         let cartTotal = cart.products.reduce((total, item) => total + item.productId.price * item.quantity, 0);

//         const currentDate = new Date();
//         const coupons = await Coupon.find({
//             expirationDate: { $gte: currentDate },
//             $expr: { $lt: ["$usedCount", "$usageLimit"] }
//         });

//         const couponData = coupons.map(coupon => ({
//             code: coupon.code,
//             discountType: coupon.discountType,
//             discountValue: coupon.discountValue,
//             minPurchaseAmount: coupon.minPrice,
//             expirationDate: coupon.expirationDate ? new Date(coupon.expirationDate).toISOString().split('T')[0] : null
//         }));

//         const appliedCouponCode = req.query.couponCode;
//         let discountAmount = 0;

//         if (appliedCouponCode) {
//             const appliedCoupon = coupons.find(coupon => coupon.code === appliedCouponCode);

//             if (appliedCoupon && cartTotal >= appliedCoupon.minPurchaseAmount) {
//                 if (appliedCoupon.discountType === 'percentage') {
//                     discountAmount = cartTotal * (appliedCoupon.discountValue / 100);
//                 } else if (appliedCoupon.discountType === 'fixed') {
//                     discountAmount = appliedCoupon.discountValue;
//                 }

//                 cartTotal -= discountAmount;
//             } else {
//                 return res.render('checkout', { 
//                     message: `Minimum purchase of ₹${appliedCoupon.minPurchaseAmount} is required to apply this coupon.`,
//                     messageType: 'error', 
//                     cart, 
//                     user, 
//                     coupons: couponData, 
//                     razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                     razorpayOrderId: null,
//                     totalAmount: cartTotal,
//                     discountAmount: 0,
//                     finalAmount: cartTotal,
//                     referralOffers: [], 
//                     cartTotal,
//                     appliedCouponCode,
//                     walletBalance: wallet?.balance || 0
//                 });
//             }
//         }

//         const totalAmountInPaise = cartTotal * 100;

//         // Razorpay order creation
//         const razorpay = new Razorpay({
//             key_id: process.env.RAZORPAY_KEY_ID,
//             key_secret: process.env.RAZORPAY_KEY_SECRET,
//         });

//         try {
//             const options = {
//                 amount: totalAmountInPaise,
//                 currency: "INR",
//                 receipt: `receipt_${Date.now()}`,
//             };

//             const order = await razorpay.orders.create(options);

//             if (!order || !order.id) {
//                 throw new Error('Razorpay order creation failed.');
//             }

//             res.render('checkout', { 
//                 message: null, 
//                 messageType: null, 
//                 cart, 
//                 user, 
//                 coupons: couponData, 
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                 razorpayOrderId: order.id,
//                 totalAmount: cartTotal + discountAmount,
//                 discountAmount,
//                 finalAmount: cartTotal,
//                 referralOffers: [], 
//                 cartTotal,
//                 appliedCouponCode,
//                 walletBalance: wallet?.balance || 0 // Ensure the correct wallet balance is passed
//             });

//         } catch (error) {
//             console.error('Error creating Razorpay order:', error.message);

//             return res.render('checkout', { 
//                 message: 'Failed to initiate payment. Please try again later.', 
//                 messageType: 'error', 
//                 cart, 
//                 user, 
//                 coupons: couponData, 
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                 razorpayOrderId: null,
//                 totalAmount: cartTotal,
//                 discountAmount: 0,
//                 finalAmount: cartTotal,
//                 referralOffers: [], 
//                 cartTotal,
//                 appliedCouponCode,
//                 walletBalance: wallet?.balance || 0
//             });
//         }

//     } catch (error) {
//         console.error('Error fetching checkout page:', error.message);
//         res.status(500).send('Internal Server Error');
//     }
// };

// const getCheckoutPage = async (req, res) => {
//     try {
//         const userId = req.session.user?.userId;

//         if (!userId) {
//             return res.redirect('/login');
//         }

//         // Fetch cart, user, and wallet information
//         const cart = await Cart.findOne({ userId }).populate('products.productId');
//         const user = await User.findById(userId);
//         const wallet = await Wallet.findOne({ user: userId }); // Fetch wallet by `user`

//         if (!cart || cart.products.length === 0) {
//             return res.render('checkout', { 
//                 message: 'Your cart is empty', 
//                 messageType: 'error', 
//                 cart: null, 
//                 user, 
//                 coupons: [], 
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                 razorpayOrderId: null,
//                 cartTotal: 0,
//                 discountAmount: 0,
//                 finalAmount: 0,
//                 appliedCouponCode: null,
//                 walletBalance: wallet?.balance || 0 
//             });
//         }

//         // Calculate cart total
//         let cartTotal = cart.products.reduce((total, item) => total + item.productId.price * item.quantity, 0);

//         // Fetch applicable offers
//         const offers = await Offer.find({
//             $or: [
//                 { applicableProducts: { $in: cart.products.map(item => item.productId._id) } },
//                 { applicableCategories: { $in: cart.products.map(item => item.productId.category) } }
//             ],
//             expirationDate: { $gte: new Date() }
//         });

//         // Calculate offer discount
//         let offerDiscount = 0;
//         offers.forEach(offer => {
//             cart.products.forEach(item => {
//                 if (
//                     offer.applicableProducts.includes(item.productId._id) ||
//                     offer.applicableCategories.includes(item.productId.category)
//                 ) {
//                     if (offer.discountType === 'percentage') {
//                         offerDiscount += item.productId.price * item.quantity * (offer.discountValue / 100);
//                     } else if (offer.discountType === 'fixed') {
//                         offerDiscount += offer.discountValue;
//                     }
//                 }
//             });
//         });

//         // Adjust cart total for offers
//         cartTotal -= offerDiscount;

//         const currentDate = new Date();
//         const coupons = await Coupon.find({
//             expirationDate: { $gte: currentDate },
//             $expr: { $lt: ["$usedCount", "$usageLimit"] }
//         });

//         const couponData = coupons.map(coupon => ({
//             code: coupon.code,
//             discountType: coupon.discountType,
//             discountValue: coupon.discountValue,
//             minPurchaseAmount: coupon.minPrice,
//             expirationDate: coupon.expirationDate ? new Date(coupon.expirationDate).toISOString().split('T')[0] : null
//         }));

//         const appliedCouponCode = req.query.couponCode;
//         let couponDiscount = 0;

//         if (appliedCouponCode) {
//             const appliedCoupon = coupons.find(coupon => coupon.code === appliedCouponCode);

//             if (appliedCoupon && cartTotal >= appliedCoupon.minPurchaseAmount) {
//                 if (appliedCoupon.discountType === 'percentage') {
//                     couponDiscount = cartTotal * (appliedCoupon.discountValue / 100);
//                 } else if (appliedCoupon.discountType === 'fixed') {
//                     couponDiscount = appliedCoupon.discountValue;
//                 }

//                 cartTotal -= couponDiscount;
//             } else {
//                 return res.render('checkout', { 
//                     message: `Minimum purchase of ₹${appliedCoupon.minPurchaseAmount} is required to apply this coupon.`,
//                     messageType: 'error', 
//                     cart, 
//                     user, 
//                     coupons: couponData, 
//                     razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                     razorpayOrderId: null,
//                     totalAmount: cartTotal,
//                     discountAmount: 0,
//                     finalAmount: cartTotal,
//                     referralOffers: [], 
//                     cartTotal,
//                     appliedCouponCode,
//                     walletBalance: wallet?.balance || 0
//                 });
//             }
//         }

//         // Final calculation
//         const totalDiscount = offerDiscount + couponDiscount;
//         const finalAmount = cartTotal;
//         const totalAmountInPaise = finalAmount * 100;

//         // Razorpay order creation
//         const razorpay = new Razorpay({
//             key_id: process.env.RAZORPAY_KEY_ID,
//             key_secret: process.env.RAZORPAY_KEY_SECRET,
//         });

//         try {
//             const options = {
//                 amount: totalAmountInPaise,
//                 currency: "INR",
//                 receipt: `receipt_${Date.now()}`,
//             };

//             const order = await razorpay.orders.create(options);

//             if (!order || !order.id) {
//                 throw new Error('Razorpay order creation failed.');
//             }

//             res.render('checkout', { 
//                 message: null, 
//                 messageType: null, 
//                 cart, 
//                 user, 
//                 coupons: couponData, 
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                 razorpayOrderId: order.id,
//                 totalAmount: cartTotal + totalDiscount,
//                 discountAmount: totalDiscount,
//                 finalAmount,
//                 referralOffers: [], 
//                 cartTotal,
//                 appliedCouponCode,
//                 walletBalance: wallet?.balance || 0 // Ensure correct wallet balance
//             });

//         } catch (error) {
//             console.error('Error creating Razorpay order:', error.message);

//             return res.render('checkout', { 
//                 message: 'Failed to initiate payment. Please try again later.', 
//                 messageType: 'error', 
//                 cart, 
//                 user, 
//                 coupons: couponData, 
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
//                 razorpayOrderId: null,
//                 totalAmount: cartTotal,
//                 discountAmount: 0,
//                 finalAmount: cartTotal,
//                 referralOffers: [], 
//                 cartTotal,
//                 appliedCouponCode,
//                 walletBalance: wallet?.balance || 0
//             });
//         }

//     } catch (error) {
//         console.error('Error fetching checkout page:', error.message);
//         res.status(500).send('Internal Server Error');
//     }
// };

// const getCheckoutPage = async (req, res) => {
//     try {
//         const userId = req.session.user?.userId;

//         // Redirect if the user is not logged in
//         if (!userId) {
//             return res.redirect('/login');
//         }

//         // Fetch cart, user, and wallet information
//         const cart = await Cart.findOne({ userId }).populate('products.productId');
//         const user = await User.findById(userId);
//         const wallet = await Wallet.findOne({ user: userId });

//         // If cart is empty, render checkout with an error message
//         if (!cart || cart.products.length === 0) {
//             return res.render('checkout', {
//                 message: 'Your cart is empty',
//                 messageType: 'error',
//                 cart: null,
//                 user,
//                 coupons: [],
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID,
//                 razorpayOrderId: null,
//                 cartTotal: 0,
//                 discountAmount: 0,
//                 finalAmount: 0,
//                 appliedCouponCode: null,
//                 walletBalance: wallet?.balance || 0,
//             });
//         }

//         // Calculate the total amount for the cart
//         let cartTotal = cart.products.reduce((total, item) => total + item.productId.price * item.quantity, 0);

//         // Fetch offers applicable to the products or categories
//         const offers = await Offer.find({
//             $or: [
//                 { applicableProducts: { $in: cart.products.map(item => item.productId._id) } },
//                 { applicableCategories: { $in: cart.products.map(item => item.productId.category) } }
//             ],
//             expirationDate: { $gte: new Date() }
//         });

//         // Calculate the discount from offers
//         let offerDiscount = 0;
//         offers.forEach(offer => {
//             cart.products.forEach(item => {
//                 if (
//                     offer.applicableProducts.includes(item.productId._id) ||
//                     offer.applicableCategories.includes(item.productId.category)
//                 ) {
//                     if (offer.discountType === 'percentage') {
//                         offerDiscount += item.productId.price * item.quantity * (offer.discountValue / 100);
//                     } else if (offer.discountType === 'fixed') {
//                         offerDiscount += offer.discountValue;
//                     }
//                 }
//             });
//         });
//         // Subtract offer discount from the cart total
//         cartTotal -= offerDiscount;
        
//         // Fetch available coupons
//         const currentDate = new Date();
//         const coupons = await Coupon.find({
//             expirationDate: { $gte: currentDate },
//             $expr: { $lt: ["$usedCount", "$usageLimit"] }
//         });

//         // Prepare coupon data for the frontend
//         const couponData = coupons.map(coupon => ({
//             code: coupon.code,
//             discountType: coupon.discountType,
//             discountValue: coupon.discountValue,
//             minPurchaseAmount: coupon.minPrice,
//             expirationDate: coupon.expirationDate ? new Date(coupon.expirationDate).toISOString().split('T')[0] : null,
//         }));

//         const appliedCouponCode = req.query.couponCode;
//         let couponDiscount = 0;

//         // Apply the coupon if one is provided
//         if (appliedCouponCode) {
//             const appliedCoupon = coupons.find(coupon => coupon.code === appliedCouponCode);

//             if (appliedCoupon && cartTotal >= appliedCoupon.minPurchaseAmount) {
//                 if (appliedCoupon.discountType === 'percentage') {
//                     couponDiscount = cartTotal * (appliedCoupon.discountValue / 100);
//                 } else if (appliedCoupon.discountType === 'fixed') {
//                     couponDiscount = appliedCoupon.discountValue;
//                 }

//                 // Subtract coupon discount from the cart total
//                 cartTotal -= couponDiscount;
//             } else {
//                 // Render checkout page with an error message if coupon minimum is not met
//                 return res.render('checkout', {
//                     message: `Minimum purchase of ₹${appliedCoupon.minPurchaseAmount} is required to apply this coupon.`,
//                     messageType: 'error',
//                     cart,
//                     user,
//                     coupons: couponData,
//                     razorpayKeyId: process.env.RAZORPAY_KEY_ID,
//                     razorpayOrderId: null,
//                     totalAmount: cartTotal + couponDiscount,
//                     discountAmount: 0,
//                     finalAmount: cartTotal,
//                     referralOffers: [],
//                     cartTotal,
//                     appliedCouponCode,
//                     walletBalance: wallet?.balance || 0
//                 });
//             }
//         }

//         // Final calculations for discount and total
//         const totalDiscount = offerDiscount + couponDiscount;
//         const finalAmount = cartTotal;
//         const totalAmountInPaise = finalAmount * 100; // Razorpay requires the amount in paise

//         // Create a Razorpay order
//         const razorpay = new Razorpay({
//             key_id: process.env.RAZORPAY_KEY_ID,
//             key_secret: process.env.RAZORPAY_KEY_SECRET,
//         });

//         const options = {
//             amount: totalAmountInPaise,
//             currency: "INR",
//             receipt: `receipt_${Date.now()}`
//         };

//         try {
//             const order = await razorpay.orders.create(options);

//             if (!order || !order.id) {
//                 throw new Error('Razorpay order creation failed.');
//             }

//             // Render checkout page with the calculated details and Razorpay order
//             res.render('checkout', {
//                 message: null,
//                 messageType: null,
//                 cart,
//                 user,
//                 coupons: couponData,
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID,
//                 razorpayOrderId: order.id,
//                 totalAmount: cartTotal + totalDiscount,
//                 discountAmount: totalDiscount,
//                 finalAmount,
//                 referralOffers: [],
//                 cartTotal,
//                 appliedCouponCode,
//                 walletBalance: wallet?.balance || 0
//             });

//         } catch (error) {
//             console.error('Error creating Razorpay order:', error.message);

//             return res.render('checkout', {
//                 message: 'Failed to initiate payment. Please try again later.',
//                 messageType: 'error',
//                 cart,
//                 user,
//                 coupons: couponData,
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID,
//                 razorpayOrderId: null,
//                 totalAmount: cartTotal,
//                 discountAmount: 0,
//                 finalAmount: cartTotal,
//                 referralOffers: [],
//                 cartTotal,
//                 appliedCouponCode,
//                 walletBalance: wallet?.balance || 0
//             });
//         }

//     } catch (error) {
//         console.error('Error fetching checkout page:', error.message);
//         res.status(500).send('Internal Server Error');
//     }
// };

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user?.userId;

        // Redirect if the user is not logged in
        if (!userId) {
            return res.redirect('/login');
        }

        // Fetch cart, user, and wallet information
        const cart = await Cart.findOne({ userId }).populate('products.productId');
        const user = await User.findById(userId);
        const wallet = await Wallet.findOne({ user: userId });

        // If cart is empty, render checkout with an error message
        if (!cart || cart.products.length === 0) {
            return res.render('checkout', {
                message: 'Your cart is empty',
                messageType: 'error',
                cart: null,
                user,
                coupons: [],
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                razorpayOrderId: null,
                cartTotal: 0,
                discountAmount: 0,
                finalAmount: 0,
                appliedCouponCode: null,
                walletBalance: wallet?.balance || 0,
            });
        }

        // Calculate the total amount for the cart
        let cartTotal = cart.products.reduce((total, item) => total + item.productId.price * item.quantity, 0);

        let offerDiscount = 0;

        // Fetch all active offers
        const activeOffers = await Offer.find({
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        // Apply applicable offers to the cart
cart.products.forEach(cartItem => {
    console.log('Checking cart item:', cartItem.productId.name, 'with price:', cartItem.productId.price, 'and quantity:', cartItem.quantity);

    activeOffers.forEach(offer => {
        console.log('Checking offer:', offer.offerType, 'with discount:', offer.discountValue, offer.discountType);

        if (offer.offerType === 'product' && offer.applicableProducts.includes(cartItem.productId._id)) {
            console.log('Offer applies to product:', cartItem.productId.name);

            if (offer.discountType === 'percentage') {
                const discount = (cartItem.productId.price * cartItem.quantity * offer.discountValue) / 100;
                offerDiscount += discount;
                console.log('Percentage discount applied:', discount);
            } else {
                const discount = offer.discountValue * cartItem.quantity;
                offerDiscount += discount;
                console.log('Fixed discount applied:', discount);
            }
        } else if (offer.offerType === 'category' && offer.applicableCategories.includes(cartItem.productId.category)) {
            console.log('Offer applies to category:', cartItem.productId.category);

            if (offer.discountType === 'percentage') {
                const discount = (cartItem.productId.price * cartItem.quantity * offer.discountValue) / 100;
                offerDiscount += discount;
                console.log('Percentage discount applied:', discount);
            } else {
                const discount = offer.discountValue * cartItem.quantity;
                offerDiscount += discount;
                console.log('Fixed discount applied:', discount);
            }
        } else {
            console.log('No offer applied for this item.');
        }
    });
});


        // Fetch available coupons
        const currentDate = new Date();
        const coupons = await Coupon.find({
            expirationDate: { $gte: currentDate },
            $expr: { $lt: ["$usedCount", "$usageLimit"] }
        });

        const appliedCouponCode = req.query.couponCode;
        let couponDiscount = 0;

        // Apply coupon if provided
        if (appliedCouponCode) {
            const appliedCoupon = coupons.find(coupon => coupon.code === appliedCouponCode);

            if (appliedCoupon && cartTotal >= appliedCoupon.minPurchaseAmount) {
                if (appliedCoupon.discountType === 'percentage') {
                    couponDiscount = cartTotal * (appliedCoupon.discountValue / 100);
                } else if (appliedCoupon.discountType === 'fixed') {
                    couponDiscount = appliedCoupon.discountValue;
                }
            }
        }

        // Calculate total discount and final amount
        const totalDiscount = offerDiscount + couponDiscount;
        const finalAmount = Math.max(cartTotal - totalDiscount, 0);
        const totalAmountInPaise = finalAmount * 100; // Razorpay requires the amount in paise

        // Create Razorpay order
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: totalAmountInPaise,
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        try {
            const order = await razorpay.orders.create(options);

            res.render('checkout', {
                message: null,
                messageType: null,
                cart,
                user,
                coupons,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                razorpayOrderId: order.id,
                cartTotal,
                offerDiscount,
                discountAmount: totalDiscount,  // This is the key update for your error
                finalAmount,
                appliedCouponCode,
                walletBalance: wallet?.balance || 0
            });

        } catch (error) {
            console.error('Error creating Razorpay order:', error.message);
            return res.render('checkout', {
                message: 'Failed to initiate payment. Please try again later.',
                messageType: 'error',
                cart,
                user,
                coupons,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                razorpayOrderId: null,
                cartTotal,
                offerDiscount,
                discountAmount: totalDiscount,  // Ensure discountAmount is passed in case of errors
                finalAmount,
                appliedCouponCode,
                walletBalance: wallet?.balance || 0
            });
        }

    } catch (error) {
        console.error('Error fetching checkout page:', error.message);
        res.status(500).send('Internal Server Error');
    }
};



// const placeOrder = async (req, res) => {
//     try {
//         const {
//             couponCode,
//             discountAmount = 0,
//             paymentMethod, 
//             shippingAddressId,
//             razorpay_payment_id,
//             razorpay_order_id,
//             razorpay_signature
//         } = req.body;

//         const userId = req.session.user?.userId;

//         if (!userId) {
//             return res.status(400).json({ success: false, message: 'User not logged in' });
//         }

//         const user = await User.findById(userId);
//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         const cart = await Cart.findOne({ userId }).populate('products.productId');
//         if (!cart || cart.products.length === 0) {
//             return res.status(400).json({ success: false, message: 'Cart is empty' });
//         }

//         let appliedCoupon = null;
//         let appliedDiscount = discountAmount;
//         if (couponCode) {
//             appliedCoupon = await Coupon.findOne({ code: couponCode });
//             if (!appliedCoupon) {
//                 return res.status(400).json({ success: false, message: 'Invalid coupon' });
//             }
//             appliedCoupon.usedCount += 1;
//             await appliedCoupon.save();

//             // Apply coupon discount if available
//             if (appliedCoupon.discountType === 'percentage') {
//                 // Calculate percentage discount
//                 appliedDiscount = (appliedCoupon.discountValue / 100) * cartTotal;

//                 // Ensure discount does not exceed the cart total
//                 if (appliedDiscount > cartTotal) {
//                     appliedDiscount = cartTotal; // Cap discount to cart total
//                 }
//             } else if (appliedCoupon.discountType === 'fixed') {
//                 // Apply fixed discount
//                 appliedDiscount = appliedCoupon.discountValue;

//                 // Ensure fixed discount does not exceed the cart total
//                 if (appliedDiscount > cartTotal) {
//                     appliedDiscount = cartTotal; // Cap discount to cart total
//                 }
//             }
//         }

//         // Offer discount logic
//         let offerDiscount = 0;

//         // Fetch all active offers
//         const activeOffers = await Offer.find({ 
//             isActive: true, 
//             startDate: { $lte: new Date() }, 
//             endDate: { $gte: new Date() }
//         });

//         // Iterate over cart products and apply applicable offers
//         cart.products.forEach(cartItem => {
//             activeOffers.forEach(offer => {
//                 if (offer.offerType === 'product' && offer.applicableProducts.includes(cartItem.productId._id)) {
//                     if (offer.discountType === 'percentage') {
//                         offerDiscount += (cartItem.productId.price * cartItem.quantity * offer.discountValue) / 100;
//                     } else {
//                         offerDiscount += offer.discountValue * cartItem.quantity;
//                     }
//                 } else if (offer.offerType === 'category' && offer.applicableCategories.includes(cartItem.productId.category)) {
//                     if (offer.discountType === 'percentage') {
//                         offerDiscount += (cartItem.productId.price * cartItem.quantity * offer.discountValue) / 100;
//                     } else {
//                         offerDiscount += offer.discountValue * cartItem.quantity;
//                     }
//                 }
//             });
//         });

//         const cartTotal = cart.products.reduce((total, product) => total + product.productId.price * product.quantity, 0);
//         const finalPrice = Math.max(cartTotal - appliedDiscount - offerDiscount, 0);

//         if (paymentMethod === 'wallet') {
//             const wallet = await Wallet.findOne({ user: userId });
//             if (!wallet || wallet.balance < finalPrice) {
//                 return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
//             }

//             wallet.balance -= finalPrice;
//             wallet.transactions.push({ type: 'debit', amount: finalPrice, description: 'Order payment' });
//             await wallet.save();
//         } else if (paymentMethod === 'Razorpay') {
//             const razorpay = new Razorpay({
//                 key_id: process.env.RAZORPAY_KEY_ID,
//                 key_secret: process.env.RAZORPAY_KEY_SECRET
//             });

//             const isValidSignature = razorpay.utils.verifyPaymentSignature({
//                 order_id: razorpay_order_id,
//                 payment_id: razorpay_payment_id,
//                 signature: razorpay_signature
//             });

//             if (!isValidSignature) {
//                 return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature' });
//             }
//         }

//         const newOrder = new Order({
//             userId,
//             products: cart.products.map(p => ({
//                 productId: p.productId._id,
//                 quantity: p.quantity
//             })),
//             totalPrice: finalPrice,
//             discountAmount: appliedDiscount,
//             shippingAddressId,
//             paymentMethod,  
//             status: 'Pending'
//         });

//         await newOrder.save();

//         // Log the order ID
//         console.log('New Order ID:', newOrder._id);

//         // Clear the cart after the order is placed
//         await Cart.findOneAndUpdate({ userId }, { $set: { products: [] } });

//         // Return success response with orderId and message
//         return res.json({
//             success: true,
//             message: 'Order placed successfully',
//             orderId: newOrder._id
//         });

//     } catch (error) {
//         console.error('Error placing order:', error.message);
//         res.status(500).json({ success: false, message: 'Error placing order' });
//     }
// };

const placeOrder = async (req, res) => {
    try {
        const {
            couponCode,
            discountAmount = 0,
            paymentMethod, 
            shippingAddressId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        } = req.body;

        const userId = req.session.user?.userId;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User not logged in' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const cartTotal = cart.products.reduce((total, product) => total + product.productId.price * product.quantity, 0);

        let appliedCoupon = null;
        let appliedDiscount = discountAmount;
        let couponDeduction = 0;

        if (couponCode) {
            appliedCoupon = await Coupon.findOne({ code: couponCode });
            if (!appliedCoupon) {
                return res.status(400).json({ success: false, message: 'Invalid coupon' });
            }
            appliedCoupon.usedCount += 1;
            await appliedCoupon.save();

            // Apply coupon discount if available
            if (appliedCoupon.discountType === 'percentage') {
                // Calculate percentage discount
                couponDeduction = (appliedCoupon.discountValue / 100) * cartTotal;

                // Ensure discount does not exceed the cart total
                if (couponDeduction > cartTotal) {
                    couponDeduction = cartTotal; // Cap discount to cart total
                }
            } else if (appliedCoupon.discountType === 'fixed') {
                // Apply fixed discount
                couponDeduction = appliedCoupon.discountValue;

                // Ensure fixed discount does not exceed the cart total
                if (couponDeduction > cartTotal) {
                    couponDeduction = cartTotal; // Cap discount to cart total
                }
            }

            // Deduct coupon amount from the final discount
            appliedDiscount = couponDeduction;
        }

        // Offer discount logic
        let offerDiscount = 0;

        // Fetch all active offers
        const activeOffers = await Offer.find({ 
            isActive: true, 
            startDate: { $lte: new Date() }, 
            endDate: { $gte: new Date() }
        });

        // Iterate over cart products and apply applicable offers
        cart.products.forEach(cartItem => {
            activeOffers.forEach(offer => {
                if (offer.offerType === 'product' && offer.applicableProducts.includes(cartItem.productId._id)) {
                    if (offer.discountType === 'percentage') {
                        offerDiscount += (cartItem.productId.price * cartItem.quantity * offer.discountValue) / 100;
                    } else {
                        offerDiscount += offer.discountValue * cartItem.quantity;
                    }
                } else if (offer.offerType === 'category' && offer.applicableCategories.includes(cartItem.productId.category)) {
                    if (offer.discountType === 'percentage') {
                        offerDiscount += (cartItem.productId.price * cartItem.quantity * offer.discountValue) / 100;
                    } else {
                        offerDiscount += offer.discountValue * cartItem.quantity;
                    }
                }
            });
        });

        const finalPrice = Math.max(cartTotal - appliedDiscount - offerDiscount, 0);

        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ user: userId });
            if (!wallet || wallet.balance < finalPrice) {
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
            }

            wallet.balance -= finalPrice;
            wallet.transactions.push({ type: 'debit', amount: finalPrice, description: 'Order payment' });
            await wallet.save();
        } else if (paymentMethod === 'Razorpay') {
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET
            });

            const isValidSignature = razorpay.utils.verifyPaymentSignature({
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id,
                signature: razorpay_signature
            });

            if (!isValidSignature) {
                return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature' });
            }
        }

        const newOrder = new Order({
            userId,
            products: cart.products.map(p => ({
                productId: p.productId._id,
                quantity: p.quantity
            })),
            totalPrice: finalPrice,
            discountAmount: appliedDiscount,
            couponDeduction, // Store coupon deduction in the order
            shippingAddressId,
            paymentMethod,  
            status: 'Pending'
        });

        await newOrder.save();

        // Clear the cart after the order is placed
        await Cart.findOneAndUpdate({ userId }, { $set: { products: [] } });

        // Return success response with orderId and message
        return res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder._id
        });

    } catch (error) {
        console.error('Error placing order:', error.message);
        res.status(500).json({ success: false, message: 'Error placing order' });
    }
};

const getOrderConfirmpage = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const orderDetails = await Order.findById(orderId).populate('products.productId');

        if (!orderDetails) {
            return res.status(404).send('Order not found');
        }

        const user = req.session.user;
        const message = req.query.message || null;
        const messageType = req.query.messageType || null;

        return res.render('orderConfirm', { orderDetails, user, message, messageType });
    } catch (error) {
        console.error('Error rendering order confirmation page:', error.message);
        return res.status(500).send('Internal Server Error');
    }
};


// const cancelOrder = async (req, res) => {
//     try {
//         const orderId = req.params.orderId;
//         console.log(`Attempting to cancel order with ID: ${orderId}`);

//         const order = await Order.findById(orderId);
//         if (!order) {
//             console.log('Order not found');
//             return res.status(404).json({ success: false, message: 'Order not found' });
//         }

//         if (order.status !== 'Pending') {
//             console.log(`Order status is ${order.status}, cannot cancel`);
//             return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
//         }

//         // Update order status and timestamp
//         order.status = 'Cancelled';
//         order.updatedAt = new Date();
//         await order.save();
//         console.log('Order status updated to Cancelled');

//         // Refund to wallet if payment was through wallet
//         if ('wallet'||'cashOnDelivery'|| 'razorpay'.includes(order.paymentMethod)) {
//             console.log('Processing refund to wallet');
        
//             let wallet = await Wallet.findOne({ user: order.userId });
//             if (!wallet) {
//                 console.log('Wallet not found, creating a new one');
//                 wallet = new Wallet({ user: order.userId, balance: 0, transactions: [] });
//             }
        
//             console.log(`Current Wallet Balance: ₹${wallet.balance}`);
//             console.log(`Refunding ₹${order.totalPrice} to wallet`);
        
//             // Ensure totalPrice is a valid number
//             if (typeof order.totalPrice !== 'number' || isNaN(order.totalPrice) || order.totalPrice < 0) {
//                 throw new Error('Invalid totalPrice value');
//             }
        
//             wallet.balance += order.totalPrice;
//             wallet.transactions.push({
//                 amount: order.totalPrice,
//                 type: 'credit',
//                 description: 'Order cancelled and refunded',
//             });
        
//             await wallet.save();
//             console.log('Wallet updated successfully. New Balance:', wallet.balance);
//         }

//         res.json({ success: true, message: 'Order cancelled successfully' });
//     } catch (error) {
//         console.error('Error cancelling order:', error.message);
//         res.status(500).json({ success: false, message: 'Error cancelling order. Please try again.' });
//     }
// };

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log(`Attempting to cancel order with ID: ${orderId}`);

        const order = await Order.findById(orderId);
        if (!order) {
            console.log('Order not found');
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Pending') {
            console.log(`Order status is ${order.status}, cannot cancel`);
            return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
        }

        // Update order status and timestamp
        order.status = 'Cancelled';
        order.updatedAt = new Date();
        await order.save();
        console.log('Order status updated to Cancelled');

        // Process refund to wallet only for non-COD payments (e.g., wallet, razorpay)
        if (['wallet', 'razorpay'].includes(order.paymentMethod)) {
            console.log('Processing refund to wallet');
        
            let wallet = await Wallet.findOne({ user: order.userId });
            if (!wallet) {
                console.log('Wallet not found, creating a new one');
                wallet = new Wallet({ user: order.userId, balance: 0, transactions: [] });
            }
        
            console.log(`Current Wallet Balance: ₹${wallet.balance}`);
            console.log(`Refunding ₹${order.totalPrice} to wallet`);
        
            // Ensure totalPrice is a valid number
            if (typeof order.totalPrice !== 'number' || isNaN(order.totalPrice) || order.totalPrice < 0) {
                throw new Error('Invalid totalPrice value');
            }
        
            wallet.balance += order.totalPrice;
            wallet.transactions.push({
                amount: order.totalPrice,
                type: 'credit',
                description: 'Order cancelled and refunded',
            });
        
            await wallet.save();
            console.log('Wallet updated successfully. New Balance:', wallet.balance);
        } else {
            console.log('Payment method is COD, no refund to wallet.');
        }

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error.message);
        res.status(500).json({ success: false, message: 'Error cancelling order. Please try again.' });
    }
};


const getProfilePage = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const user = await User.findById(userId);
        res.render('profile', { user });
    } catch (error) {
        console.error('Error fetching profile page:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const getaddresPage = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const user = await User.findById(userId).populate('addresses');
        res.render('manageAddress', { user });
    } catch (error) {
        console.error('Error fetching address page:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const addAddress = async (req, res) => {
    const { firstName, lastName, companyName, address1, address2, city, state, zip, phone, email } = req.body;

    try {
        const userId = req.session.user?.userId;
        if (!userId) {
            console.error('User ID not found in session.');
            return res.status(401).send('User not authenticated');
        }

        const user = await User.findById(userId);
        user.addresses.push({ firstName, lastName, companyName, address1, address2, city, state, zip, phone, email });
        await user.save();
        res.redirect('/profile/add-addressPage');  // Redirect back to address page
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).send('Server Error');
    }
};

const getEditAddressPage = async (req, res) => {
    try {
        const userId = req.session.user?.userId;
        if (!userId) {
            console.error('User ID not found in session.');
            return res.status(401).send('User not authenticated');
        }

        const addressId = req.params.id;
        const user = await User.findById(userId);
        const address = user.addresses.id(addressId);

        if (!address) {
            return res.status(404).send('Address not found');
        }

        res.render('editAddress', { address });
    } catch (error) {
        console.error('Error fetching edit address page:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const editAddress = async (req, res) => {
    try {
        const userId = req.session.user?.userId;
        if (!userId) {
            console.error('User ID not found in session.');
            return res.status(401).send('User not authenticated');
        }

        const addressId = req.params.id;
        await User.updateOne(
            { _id: userId, 'addresses._id': addressId },
            { $set: { 'addresses.$': req.body } }
        );
        res.redirect('/profile/add-addressPage');
    } catch (error) {
        console.error('Error editing address:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user?.userId;
        if (!userId) {
            console.error('User ID not found in session.');
            return res.status(401).send('User not authenticated');
        }

        const addressId = req.params.id;
        await User.findByIdAndUpdate(userId, { $pull: { addresses: { _id: addressId } } });
        res.redirect('/profile/add-addressPage');
    } catch (error) {
        console.error('Error deleting address:', error.message);
        res.status(500).send('Internal Server Error');
    }
};


// const getOrderListing = async (req, res) => {
//     try {
//         // Ensure the user is logged in and has a session
//         if (!req.session.user || !req.session.user.userId) {
//             return res.status(401).send('Unauthorized');
//         }

//         // Fetch orders for the logged-in user and sort them by creation date in descending order
//         const orders = await Order.find({ userId: req.session.user.userId })
//             .populate('products.productId')
//             .sort({ createdAt: -1 });

//         // Map the order products to include detailed product information
//         const ordersWithProductDetails = orders.map(order => {
//             return {
//                 ...order.toObject(),
//                 products: order.products.map(product => ({
//                     name: product.productId.name,
//                     images: product.productId.images,
//                     price: product.productId.price,
//                     quantity: product.quantity
//                 }))
//             };
//         });

//         // Debugging output to check if images are correctly populated
//         console.log('Orders with product details:', ordersWithProductDetails);

//         // Render the order listing page with populated orders
//         res.render('orderListing', { orders: ordersWithProductDetails });
//     } catch (error) {
//         console.error('Error fetching orders:', error);
//         res.status(500).send('Server Error');
//     }
// };

const getOrderListing = async (req, res) => {
    try {
        // Ensure the user is logged in and has a session
        if (!req.session.user || !req.session.user.userId) {
            return res.status(401).send('Unauthorized');
        }

        // Get the current page number from query parameters (default to 1 if not provided)
        const page = parseInt(req.query.page) || 1;
        const limit = 5;  // Number of orders per page
        const skip = (page - 1) * limit;

        // Fetch total count of orders for pagination
        const totalOrders = await Order.countDocuments({ userId: req.session.user.userId });

        // Fetch paginated orders for the logged-in user, sorted by creation date in descending order
        const orders = await Order.find({ userId: req.session.user.userId })
            .populate('products.productId')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        // Map the order products to include detailed product information
        const ordersWithProductDetails = orders.map(order => ({
            ...order.toObject(),
            products: order.products.map(product => ({
                name: product.productId.name,
                images: product.productId.images,
                price: product.productId.price,
                quantity: product.quantity
            }))
        }));

        // Calculate total pages for pagination
        const totalPages = Math.ceil(totalOrders / limit);

        // Render the order listing page with populated orders and pagination data
        res.render('orderListing', {
            orders: ordersWithProductDetails,
            currentPage: page,
            totalPages: totalPages,
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};


const updateProfile = async (req, res) => {
    const { name, mobile, password } = req.body;
    try {
        const user = await User.findById(req.session.user?.userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        
        user.name = name;
        user.mobile = mobile;

        if (password) {
            // Hash the new password before saving it
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();

        // Update session data
        req.session.user = {
            ...req.session.user,
            name: user.name,
            mobile: user.mobile,
            email: user.email,  // Ensure all necessary fields are included
            username: user.username,
            isAdmin: user.isAdmin,
            isBlocked: user.isBlocked
        };

        console.log('Updated user session data:', req.session.user);

        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Server Error');
    }
};

// const getOrderDetails = async (req, res) => {
//     try {
//         const orderId = req.params.orderId;
        
//         // Fetch order details, including product and shipping address information
//         const order = await Order.findById(orderId)
//             .populate('products.productId')
//             .populate('shippingAddressId');

//         if (!order) {
//             return res.status(404).send('Order not found');
//         }

//         res.render('orderDetailspage', { order });
//     } catch (error) {
//         console.error('Error fetching order details:', error);
//         res.status(500).send('Server Error');
//     }
// };


// const getOrderDetails = async (req, res) => {
//     try {
//         const orderId = req.params.orderId;

//         // Fetch order details
//         const order = await Order.findById(orderId)
//             .populate('products.productId') // Populate product details
//             .populate('couponId'); // Populate coupon details

//         if (!order) {
//             return res.status(404).send('Order not found');
//         }

//         // Fetch user details to get the shipping address
//         const user = await User.findById(order.userId);

//         if (!user) {
//             return res.status(404).send('User not found');
//         }

//         // Find the shipping address from user's addresses
//         const shippingAddress = user.addresses.id(order.shippingAddressId);

//         // Ensure the shipping address exists
//         if (!shippingAddress) {
//             return res.status(404).send('Shipping address not found');
//         }

//         // Render the order details page with the fetched data
//         res.render('orderDetailspage', {
//             order,
//             shippingAddress
//         });
//     } catch (error) {
//         console.error('Error fetching order details:', error);
//         res.status(500).send('Server Error');
//     }
// };

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Fetch order details
        const order = await Order.findById(orderId)
            .populate('products.productId') // Populate product details
            .populate('couponId'); // Populate coupon details

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Fetch user details to get the shipping address
        const user = await User.findById(order.userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Find the shipping address from user's addresses
        const shippingAddress = user.addresses.id(order.shippingAddressId);

        // Ensure the shipping address exists
        if (!shippingAddress) {
            return res.status(404).send('Shipping address not found');
        }

        // Render the order details page with the fetched data
        res.render('orderDetailspage', {
            order,
            shippingAddress
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Server Error');
    }
};

// const returnOrder = async (req, res) => {
//     try {
//         const { orderId } = req.params;
//         const { reason } = req.body;

//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({ success: false, message: 'Order not found' });
//         }

//         if (order.status !== 'Delivered') {
//             return res.status(400).json({ success: false, message: 'Only delivered products can be returned.' });
//         }

//         order.returnRequested = true;
//         order.returnReason = reason;
//         order.status = 'Return Requested'; // Updating status for user's view
//         await order.save();

//         // Refund to wallet
//         const wallet = await Wallet.findOne({ user: order.userId });
//         wallet.balance += order.totalPrice;
//         wallet.transactions.push({
//             amount: order.totalPrice,
//             type: 'credit',
//             description: 'Order returned and refunded',
//         });
//         await wallet.save();

//         res.json({ success: true, message: 'Return request submitted successfully.' });
//     } catch (error) {
//         console.error('Error requesting return:', error);
//         res.status(500).json({ success: false, message: 'Failed to request return.' });
//     }
// };

const returnOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered products can be returned.' });
        }

        order.returnRequested = true;
        order.returnReason = reason;
        order.status = 'Return Requested'; // Update status
        await order.save();

        res.json({ success: true, message: 'Return request submitted successfully.' });
    } catch (error) {
        console.error('Error requesting return:', error);
        res.status(500).json({ success: false, message: 'Failed to request return.' });
    }
};


const getforgotPassword = async (req, res) => {
    try {
        res.render("forgotPassword");
    } catch (error) {
        console.error('Error fetching forgotPassword page:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Forgot password request received for email:', email);

        // Check if the email exists
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found', messageType: 'error' });
        }

        // Generate a numeric OTP
        const otpCode = generateNumericOtp(6);
        const hashedOtp = await bcrypt.hash(otpCode, 10);

        // Save OTP to the database
        const otpRecord = await Otp.findOneAndUpdate(
            { email },
            { otp: hashedOtp, createdAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Log OTP save result
        if (!otpRecord) {
            console.error('Failed to save OTP to the database');
            return res.status(500).json({ message: 'Failed to save OTP', messageType: 'error' });
        }

        // Send OTP via email
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            text: `Your OTP code is ${otpCode}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending OTP email:', error);
                return res.status(500).json({ message: 'Error sending OTP email', messageType: 'error' });
            }
            console.log('OTP email sent:', info.response);
            res.status(200).json({ message: 'An OTP has been sent to your email. Please check your inbox.', messageType: 'success' });
        });
    } catch (error) {
        console.error('Error during forgot password process:', error.message);
        res.status(500).json({ message: 'Internal Server Error', messageType: 'error' });
    }
};


const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        console.log('Reset password request received:', req.body);

        if (!email || !otp || !newPassword) {
            console.log('All fields are required');
            return res.status(400).json({ message: 'All fields are required', messageType: 'error' });
        }

        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord) {
            console.log('Invalid or expired OTP');
            return res.status(400).json({ message: 'Invalid or expired OTP', messageType: 'error' });
        }

        // Check if OTP is expired
        const now = new Date();
        const otpAge = (now - otpRecord.createdAt) / 1000; // Age in seconds
        if (otpAge > 300) { // 5 minutes TTL
            await Otp.deleteOne({ email }); // Delete expired OTP
            console.log('Expired OTP');
            return res.status(400).json({ message: 'Invalid or expired OTP', messageType: 'error' });
        }

        const isMatch = await bcrypt.compare(otp.trim(), otpRecord.otp);
        if (!isMatch) {
            console.log('Invalid OTP');
            return res.status(400).json({ message: 'Invalid or expired OTP', messageType: 'error' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password and delete OTP
        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        await Otp.deleteOne({ email }); // Delete OTP after successful reset

        console.log('Password has been reset successfully for email:', email);
        res.status(200).json({ message: 'Password has been reset successfully', messageType: 'success' });
    } catch (error) {
        console.error('Error during password reset process:', error.message);
        res.status(500).json({ message: 'Internal Server Error', messageType: 'error' });
    }
};

// Function to calculate coupon discount
const calculateCouponDiscount = async (couponCode, totalPrice) => {
    try {
        // Find the coupon by code
        const coupon = await Coupon.findOne({ code: couponCode });

        if (!coupon) {
            throw new Error('Invalid coupon code.');
        }

        // Check if the coupon is expired or usage limit exceeded
        const currentDate = new Date();
        if (coupon.expirationDate < currentDate || coupon.usedCount >= coupon.usageLimit) {
            throw new Error('Coupon expired or usage limit exceeded.');
        }

        // Calculate the discount
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (totalPrice * coupon.discountValue) / 100;
        } else if (coupon.discountType === 'fixed') {
            discountAmount = coupon.discountValue;
        }

        return { success: true, discountAmount, discountType: coupon.discountType, discountValue: coupon.discountValue };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

// Existing applyCoupon route handler
const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user?.userId;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User not logged in' });
        }

        console.log('Coupon code received:', couponCode); // Debugging line

        // Retrieve the user's cart
        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: 'Cart not found or is empty' });
        }

        // Retrieve the coupon by code
        const coupon = await Coupon.findOne({ code: couponCode }).exec();
        if (!coupon) {
            console.log('Coupon not found in the database'); // Debugging line
            return res.status(400).json({ message: 'Invalid coupon code' });
        }

        // Check if the coupon is expired
        const currentDate = new Date();
        if (coupon.expirationDate < currentDate) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

        // Check if the coupon usage limit has been reached
        if (coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        // Calculate the total cart value
        const cartTotal = cart.products.reduce((total, product) => total + product.productId.price * product.quantity, 0);

        // Check if the cart total meets the minimum purchase requirement for the coupon
        if (cartTotal < coupon.minPrice) {
            return res.status(400).json({ message: `Minimum purchase of ₹${coupon.minPrice} is required to apply this coupon.` });
        }

        // Calculate the discount
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = cartTotal * (coupon.discountValue / 100);
        } else if (coupon.discountType === 'fixed') {
            discountAmount = coupon.discountValue;
        }

        // Ensure discountAmount does not exceed cartTotal
        discountAmount = Math.min(discountAmount, cartTotal);

        // Increment the usedCount since the coupon is being applied
        coupon.usedCount += 1;
        await coupon.save();

        // Calculate the final amount
        const finalAmount = cartTotal - discountAmount;

        // Respond with the discount amount and the updated cart total
        return res.status(200).json({
            message: 'Coupon applied successfully',
            discountAmount,
            finalAmount
        });

    } catch (error) {
        console.error('Error applying coupon:', error.message);
        return res.status(500).json({ message: 'Error applying coupon' });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId;
        const userId = await User.findById(req.session.user?.userId);

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, products: [] });
        }

        if (!wishlist.products.includes(productId)) {
            wishlist.products.push(productId);
            await wishlist.save();
            return res.status(200).json({ success: true, message: 'Product added to wishlist' });
            
        } else {
            return res.status(400).json({ success: false, message: 'Product already in wishlist' });
        }
    } catch (err) {
        console.error('Error adding product to wishlist:', err);
        return res.status(500).json({ success: false, message: 'Failed to add product to wishlist' });
    }
};


  // Remove product from wishlist
const removeFromWishlist = async (req, res) => {
    try {
      const wishlist = await Wishlist.findOne({ user: req.session.user?.userId });
      if (wishlist) {
        wishlist.products = wishlist.products.filter(productId => productId.toString() !== req.body.productId);
        await wishlist.save();
        res.status(200).json({ success: true, message: 'Product removed from wishlist' });
      } else {
        res.status(404).json({ success: false, message: 'Wishlist not found' });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to remove product from wishlist' });
    }
  };

const getWishlist = async (req, res) => {
    try {
        console.log('User ID from session:', req.session.user?.userId);

        const wishlist = await Wishlist.findOne({ user: req.session.user?.userId })
            .populate('products');

        console.log('Fetched wishlist:', wishlist);

        res.render('wishList', { wishlist });
    } catch (err) {
        console.error('Error retrieving wishlist:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve wishlist' });
    }
};


const getWalletDetails = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send('User not authenticated');
        }

        const userId = req.session.user.userId;
        let wallet = await Wallet.findOne({ user: userId });

        // If wallet doesn't exist, create one
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
            await wallet.save();
        }

        const page = parseInt(req.query.page) || 1; // Get current page, default to 1
        const limit = 5; // Limit of transactions per page
        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        // Paginated transactions
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        const paginatedTransactions = wallet.transactions.slice(skip, skip + limit);

        res.render('wallet', { 
            wallet: { ...wallet.toObject(), transactions: paginatedTransactions },
            currentPage: page,
            totalPages 
        });
    } catch (error) {
        console.log('Error retrieving wallet details:', error.message);
        res.status(500).send('Server Error');
    }
};


const addFunds = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send('User not authenticated');
        }

        const userId = req.session.user.userId;
        const { amount, description } = req.body;

        console.log(amount);
        

        let wallet = await Wallet.findOne({ user: userId });
        console.log(wallet);
        

        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        }

        wallet.balance += Math.round(amount);
        wallet.transactions.push({
            amount,
            type: 'credit',
            description,
        });

        await wallet.save();

        res.redirect('/wallet');
    } catch (error) {
        console.log('Error adding funds:', error.message);
        res.status(500).send('Server Error');
    }
};


const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  
  const createRazorpayOrder = async (req, res) => {
    const { finalAmount } = req.body;
  
    const options = {
      amount: finalAmount * 100, // Amount in paise
      currency: 'INR',
      receipt: crypto.randomBytes(10).toString('hex'),
    };
  
    try {
      const order = await instance.orders.create(options);
      res.json({
        id: order.id,
        amount: order.amount,
        key: process.env.RAZORPAY_KEY_ID
      });
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
    }
  };

  const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shippingAddressId, finalAmount, couponCode } = req.body;

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature === razorpay_signature) {
        try {
            // Create and save the order
            const order = new Order({
                userId: req.user._id, // Assuming you're using req.user to get the logged-in user
                products: req.session.cart.products, // Assuming cart is saved in session
                shippingAddressId: shippingAddressId,
                totalPrice: finalAmount,
                paymentMethod: 'Razorpay',
                status: 'Paid',
                createdAt: new Date()
            });

            await order.save();

            // Clear cart after order placement
            req.session.cart = null;

            res.json({ success: true, message: 'Payment verified successfully, and order placed!' });
        } catch (error) {
            console.error('Error placing order:', error);
            res.status(500).json({ success: false, message: 'Failed to place order. Please try again.' });
        }
    } else {
        res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
};

// const applyOffer = async (req, res) => {
//     try {
//         const { offerCode, cart } = req.body; // Cart should contain product details
//         const offer = await Offer.findOne({ offerCode, expirationDate: { $gte: new Date() }, usedCount: { $lt: '$usageLimit' } });

//         if (!offer) {
//             return res.status(400).json({ message: 'Invalid or expired offer' });
//         }

//         let discountAmount = 0;
//         if (offer.type === 'product') {
//             // Apply product-specific offer
//             cart.products.forEach(product => {
//                 if (product.productId === offer.productId.toString()) {
//                     discountAmount += calculateDiscount(product.price, offer.discountValue, offer.discountType);
//                 }
//             });
//         } else if (offer.type === 'category') {
//             // Apply category-specific offer
//             cart.products.forEach(async product => {
//                 const productData = await Product.findById(product.productId);
//                 if (productData.categoryId === offer.categoryId.toString()) {
//                     discountAmount += calculateDiscount(product.price, offer.discountValue, offer.discountType);
//                 }
//             });
//         }

//         res.json({ message: 'Offer applied successfully', discountAmount });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Error applying offer' });
//     }
// };

// function calculateDiscount(price, discountValue, discountType) {
//     return discountType === 'percentage' ? price * (discountValue / 100) : discountValue;
// }

const applyOffer = async (req, res) => {
    try {
        const { offerCode, cart } = req.body; // Cart should contain product details
        const offer = await Offer.findOne({
            offerCode,
            expirationDate: { $gte: new Date() },
            usedCount: { $lt: '$usageLimit' }
        });

        if (!offer) {
            return res.status(400).json({ message: 'Invalid or expired offer' });
        }

        let discountAmount = 0;

        // Apply product-specific offer
        if (offer.type === 'product') {
            cart.products.forEach(product => {
                if (product.productId === offer.productId.toString()) {
                    discountAmount += calculateDiscount(product.price, offer.discountValue, offer.discountType);
                }
            });
        }

        // Apply category-specific offer
        else if (offer.type === 'category') {
            for (let product of cart.products) {
                const productData = await Product.findById(product.productId);
                if (productData.categoryId === offer.categoryId.toString()) {
                    discountAmount += calculateDiscount(product.price, offer.discountValue, offer.discountType);
                }
            }
        }

        res.json({ message: 'Offer applied successfully', discountAmount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error applying offer' });
    }
};

// Helper function to calculate discount
function calculateDiscount(price, discountValue, discountType) {
    return discountType === 'percentage' ? price * (discountValue / 100) : discountValue;
}


module.exports = {
    signUpPage,
    loginPage,
    signUp,
    login,
    logout,
    HomePage,
    verifyOtp,
    resendOtp,
    getShopPage,
    getProductDescriptionPage,
    getProfilePage,
    getCart,
    removeFromCart,
    addToCart,
    clearCart,
    getCheckoutPage,
    placeOrder,
    getOrderConfirmpage,
    getaddresPage,
    addAddress,
    editAddress,
    deleteAddress,
    getEditAddressPage,
    getOrderListing,
    updateProfile,
    getforgotPassword,
    forgotPassword,
    resetPassword,
    updateCart,
    getOrderDetails,
    search,
    returnOrder,
    cancelOrder,
    applyCoupon,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    getWalletDetails,
    addFunds,
    createRazorpayOrder,
    verifyPayment,
    applyOffer
};