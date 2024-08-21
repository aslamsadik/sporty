const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderShema');
const Offer = require('../models/offerModel');
const Coupon = require('../models/coupenModel');
const Wishlist = require('../models/wishlistModel');
const Wallet = require('../models/walletModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

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

        return res.render('home', { products, message: null, messageType: null });
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

        // Fetch products with sorting, filtering, and pagination
        const products = await Product.find(filter)
            .sort({ price: sort === 'price' ? 1 : -1 })
            .skip((page - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE);

        // Fetch distinct categories and brands for filters
        const categoriesList = await Product.distinct('category');
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
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found');
        }
        res.render('shopdetails', { product });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};


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
        const quantity = parseInt(req.body.quantity, 10) || 1; // Ensure quantity is an integer

        // Fetch the product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ success: false, message: 'Not enough stock available' });
        }

        // Retrieve the user's cart
        let cart = await Cart.findOne({ userId });

        if (cart) {
            // Check if the product already exists in the cart
            const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
            if (productIndex > -1) {
                // Update quantity of existing product
                cart.products[productIndex].quantity += quantity;
            } else {
                // Add new product to cart
                cart.products.push({ productId, quantity });
            }
        } else {
            // Create a new cart for the user if it doesn't exist
            cart = new Cart({ userId, products: [{ productId, quantity }] });
        }

        // Recalculate the total price by populating product details
        cart = await cart.populate('products.productId');

        cart.totalPrice = cart.products.reduce((total, item) => {
            const itemPrice = item.productId.price; // Ensure this is populated
            return total + (itemPrice * item.quantity);
        }, 0);

        // Save the updated cart
        await cart.save();

        // Update product stock
        product.stock -= quantity;
        await product.save();

        // Return a success response
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

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user?.userId;

        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate('products.productId');
        const user = await User.findById(userId);

        if (!cart || cart.products.length === 0) {
            return res.render('checkout', { 
                message: 'Your cart is empty', 
                messageType: 'error', 
                cart: null, 
                user, 
                coupons: [], 
                razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
                razorpayOrderId: null 
            });
        }

        // Calculate the total amount
        let totalAmount = cart.products.reduce((total, product) => total + product.productId.price * product.quantity, 0);

        // Fetch available coupons that are not expired and within usage limits
        const currentDate = new Date();
        const coupons = await Coupon.aggregate([
            { $match: { expirationDate: { $gte: currentDate } } },
            { $match: { $expr: { $lt: ["$usedCount", "$usageLimit"] } } }
        ]);

        // Map the coupons to ensure the `expiryDate` is valid
        const couponData = coupons.map(coupon => ({
            code: coupon.code,
            discountPercentage: coupon.discountType === 'percentage' ? coupon.discountValue : null,
            discountAmount: coupon.discountType === 'fixed' ? coupon.discountValue : null,
            expirationDate: coupon.expirationDate ? new Date(coupon.expirationDate) : null // This line ensures valid expiry date
        }));

        // Check if a coupon is applied
        const appliedCouponCode = req.query.couponCode;
        let discountAmount = 0;

        if (appliedCouponCode) {
            const appliedCoupon = coupons.find(coupon => coupon.code === appliedCouponCode);

            if (appliedCoupon) {
                if (appliedCoupon.discountPercentage) {
                    discountAmount = totalAmount * (appliedCoupon.discountPercentage / 100);
                } else if (appliedCoupon.discountAmount) {
                    discountAmount = appliedCoupon.discountAmount;
                }

                totalAmount -= discountAmount;
            }
        }

        // Convert the total amount to paise (required by Razorpay)
        const totalAmountInPaise = totalAmount * 100;

        // Initialize Razorpay
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Create a Razorpay order
        const options = {
            amount: totalAmountInPaise,
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        // Render the checkout page with the order ID and updated total amount
        res.render('checkout', { 
            message: null, 
            messageType: null, 
            cart, 
            user, 
            coupons: couponData, 
            razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
            razorpayOrderId: order.id,
            totalAmount
        });

    } catch (error) {
        console.error('Error fetching checkout page:', error.message, error);
        res.status(500).send('Internal Server Error');
    }
};



// const placeOrder = async (req, res) => {
//     try {
//         const userId = req.session.user?.userId;

//         if (!userId) {
//             return res.status(401).json({ message: 'User is not authenticated' });
//         }

//         const { shippingAddressId, orderNotes, paymentMethod, couponCode } = req.body;

//         const user = await User.findById(userId);
//         if (!user) {
//             return res.status(404).json({ message: 'User not found' });
//         }

//         const cart = await Cart.findOne({ userId }).populate('products.productId');
//         if (!cart || cart.products.length === 0) {
//             return res.status(400).json({ message: 'Your cart is empty' });
//         }

//         const selectedShippingAddress = user.addresses.id(shippingAddressId);
//         if (!selectedShippingAddress) {
//             return res.status(400).json({ message: 'Shipping address not found' });
//         }

//         let isOutOfStock = false;
//         const updatedProducts = [];

//         for (const item of cart.products) {
//             const product = await Product.findById(item.productId._id);

//             if (!product) {
//                 return res.status(404).json({ message: 'Product not found' });
//             }

//             if (product.stock < item.quantity) {
//                 isOutOfStock = true;
//                 break;
//             }

//             product.stock -= item.quantity;
//             await product.save();

//             updatedProducts.push({
//                 productId: product._id,
//                 quantity: item.quantity,
//             });
//         }

//         if (isOutOfStock) {
//             return res.status(400).json({ message: 'One or more products are out of stock' });
//         }

//         let totalPrice = cart.products.reduce((total, product) => total + product.productId.price * product.quantity, 0);

//         let discountAmount = 0;
//         if (couponCode) {
//             const couponResponse = await calculateCouponDiscount(couponCode, totalPrice);
//             if (couponResponse.success) {
//                 discountAmount = couponResponse.discountAmount;
//             } else {
//                 return res.status(400).json({ message: couponResponse.message });
//             }
//         }

//         const finalPrice = totalPrice - discountAmount;

//         if (paymentMethod === 'wallet') {
//             const wallet = await Wallet.findOne({ user: userId });
//             if (!wallet || wallet.balance < finalPrice) {
//                 return res.status(400).json({ message: 'Insufficient wallet balance' });
//             }

//             wallet.balance -= finalPrice;
//             wallet.transactions.push({
//                 amount: finalPrice,
//                 type: 'debit',
//                 description: 'Order payment',
//             });

//             await wallet.save();
//         }

//         const order = new Order({
//             userId,
//             products: updatedProducts,
//             shippingAddressId,
//             orderNotes,
//             paymentMethod,
//             totalPrice,
//             discountAmount,
//             finalPrice,
//             status: 'Pending',
//         });

//         await order.save();

//         cart.products = [];
//         await cart.save();

//         res.status(200).json({ message: 'Order placed successfully', orderId: order._id });
//     } catch (error) {
//         console.error('Error placing order:', error);
//         res.status(500).json({ message: 'Error placing order' });
//     }
// };

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user?.userId;

        if (!userId) {
            return res.status(401).json({ message: 'User is not authenticated' });
        }

        const { shippingAddressId, orderNotes, paymentMethod, couponCode, razorpayPaymentId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty' });
        }

        const selectedShippingAddress = user.addresses.id(shippingAddressId);
        if (!selectedShippingAddress) {
            return res.status(400).json({ message: 'Shipping address not found' });
        }

        let isOutOfStock = false;
        const updatedProducts = [];

        for (const item of cart.products) {
            const product = await Product.findById(item.productId._id);

            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            if (product.stock < item.quantity) {
                isOutOfStock = true;
                break;
            }

            product.stock -= item.quantity;
            await product.save();

            updatedProducts.push({
                productId: product._id,
                quantity: item.quantity,
            });
        }

        if (isOutOfStock) {
            return res.status(400).json({ message: 'One or more products are out of stock' });
        }

        // Calculate total price before discount
        let totalPriceBeforeDiscount = cart.products.reduce((total, item) => {
            const product = item.productId;
            return total + product.price * item.quantity;
        }, 0);

        let discountAmount = 0;

        // Check if a valid coupon code is applied
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode });

            if (!coupon || coupon.usedCount >= coupon.usageLimit || coupon.expirationDate < new Date()) {
                return res.status(400).json({ message: 'Invalid or expired coupon code' });
            }

            if (coupon.discountType === 'percentage') {
                discountAmount = totalPriceBeforeDiscount * (coupon.discountValue / 100);
            } else if (coupon.discountType === 'fixed') {
                discountAmount = coupon.discountValue;
            }

            // Ensure discount does not exceed the total price
            if (discountAmount > totalPriceBeforeDiscount) {
                discountAmount = totalPriceBeforeDiscount;
            }

            coupon.usedCount += 1;
            await coupon.save();
        }

        // Calculate final total price after discount
        let totalPrice = Math.round(totalPriceBeforeDiscount - discountAmount);

        // Ensure total price is not negative
        if (totalPrice < 0) {
            totalPrice = 0;
        }

        // Handle payment method
        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ user: userId });

            if (!wallet || wallet.balance < totalPrice) {
                return res.status(400).json({ message: 'Insufficient wallet balance' });
            }

            wallet.balance -= totalPrice;
            wallet.transactions.push({
                amount: totalPrice,
                type: 'debit',
                description: 'Order placed',
            });

            await wallet.save();
        } else if (paymentMethod === 'razorpay') {
            // Verify Razorpay payment
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
            const key_secret = process.env.RAZORPAY_KEY_SECRET;

            const hmac = crypto.createHmac('sha256', key_secret);
            hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
            const generated_signature = hmac.digest('hex');

            if (generated_signature !== razorpay_signature) {
                return res.status(400).json({ message: 'Payment verification failed' });
            }
        }

        const order = new Order({
            userId,
            products: updatedProducts,
            shippingAddress: selectedShippingAddress,
            shippingAddressId,
            totalPrice,
            discountAmount,
            couponCode,
            paymentMethod,
            orderNotes,
            status: paymentMethod === 'razorpay' ? 'Paid' : 'Pending', // Set status based on payment method
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await order.save();
        await Cart.deleteOne({ userId });

        res.json({ success: true, orderId: order._id });
    } catch (error) {
        console.error('Error placing order:', error.message);
        res.status(500).json({ message: `Error placing order: ${error.message}` });
    }
};

const getOrderConfirmpage = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log('Order ID:', orderId); // Log orderId

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            console.log('Invalid order ID');
            return res.status(400).render('orderConfirm', { order: null, message: 'Invalid order ID', messageType: 'error' });
        }

        const order = await Order.findById(orderId).populate('products.productId');
        console.log('Order:', order); // Log the order object

        if (!order) {
            console.log('Order not found');
            return res.status(404).render('orderConfirm', { order: null, message: 'Order not found', messageType: 'error' });
        }

        res.render('orderConfirm', { order, message: null, messageType: null });
    } catch (error) {
        console.error('Error retrieving order details:', error.message);
        res.status(500).render('orderConfirm', { order: null, message: 'Error retrieving order details. Please try again.', messageType: 'error' });
    }
};

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

        // Refund to wallet if payment was through wallet
        if ('wallet'||'cashOnDelivery'|| 'razorpay'.includes(order.paymentMethod)) {
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

const getOrderListing = async (req, res) => {
    try {
        // Ensure the user is logged in and has a session
        if (!req.session.user || !req.session.user.userId) {
            return res.status(401).send('Unauthorized');
        }

        // Fetch orders for the logged-in user and sort them by creation date in descending order
        const orders = await Order.find({ userId: req.session.user.userId })
            .populate('products.productId')
            .sort({ createdAt: -1 });

        // Map the order products to include detailed product information
        const ordersWithProductDetails = orders.map(order => {
            return {
                ...order.toObject(),
                products: order.products.map(product => ({
                    name: product.productId.name,
                    images: product.productId.images,
                    price: product.productId.price,
                    quantity: product.quantity
                }))
            };
        });

        // Debugging output to check if images are correctly populated
        console.log('Orders with product details:', ordersWithProductDetails);

        // Render the order listing page with populated orders
        res.render('orderListing', { orders: ordersWithProductDetails });
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

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        
        // Fetch order details, including product and shipping address information
        const order = await Order.findById(orderId)
            .populate('products.productId')
            .populate('shippingAddressId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        res.render('orderDetailspage', { order });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Server Error');
    }
};

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
        order.status = 'Return Requested'; // Updating status for user's view
        await order.save();

        // Refund to wallet
        const wallet = await Wallet.findOne({ user: order.userId });
        wallet.balance += order.totalPrice;
        wallet.transactions.push({
            amount: order.totalPrice,
            type: 'credit',
            description: 'Order returned and refunded',
        });
        await wallet.save();

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
    // try {
    //     const { couponCode, totalPrice } = req.body;

    //     const couponResponse = await calculateCouponDiscount(couponCode, totalPrice);

    //     if (!couponResponse.success) {
    //         return res.status(400).json({ message: couponResponse.message });
    //     }

    //     res.json(couponResponse);
    // } catch (error) {
    //     console.error('Error applying coupon:', error.message);
    //     res.status(500).json({ message: 'Internal Server Error' });
    // }
};

// Add product to wishlist
const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId;
        const userId =await User.findById(req.session.user?.userId);

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
        const wishlist = await Wishlist.findOne({ user: req.session.user?.userId }).populate('products');
        res.render('wishList', { wishlist });
    } catch (err) {
        console.log(err.message);
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

        console.log('Wallet Details:', wallet);  // Log the wallet details for debugging

        res.render('wallet', { wallet });
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

        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        }

        wallet.balance += amount;
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

const deductFunds = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send('User not authenticated');
        }

        const userId = req.session.user.userId;
        const { amount, description } = req.body;

        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet || wallet.balance < amount) {
            return res.status(400).send('Insufficient funds in wallet');
        }

        wallet.balance -= amount;
        wallet.transactions.push({
            amount,
            type: 'debit',
            description,
        });

        await wallet.save();

        res.redirect('/wallet');
    } catch (error) {
        console.log('Error deducting funds:', error.message);
        res.status(500).send('Server Error');
    }
};

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrder = async (req, res) => {
    try {
        const { amount } = req.body; // Amount from frontend in INR

        const options = {
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            receipt: 'order_rcptid_' + new Date().getTime(),
        };

        const order = await razorpay.orders.create(options);

        if (!order) {
            return res.status(500).json({ error: 'Unable to create order' });
        }

        res.json({
            success: true,
            order_id: order.id,
            key_id: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Error creating Razorpay order' });
    }
};

// Verify Payment
const verifyPayment = (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature === razorpay_signature) {
        // Signature is valid, update order status to "Paid"
        // Ideally, update the database here

        res.json({ success: true, message: 'Payment verified successfully' });
    } else {
        // Signature mismatch
        res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
};

const applyOffer = async (req, res) => {
    try {
        const { offerCode, cart } = req.body; // Cart should contain product details
        const offer = await Offer.findOne({ offerCode, expirationDate: { $gte: new Date() }, usedCount: { $lt: '$usageLimit' } });

        if (!offer) {
            return res.status(400).json({ message: 'Invalid or expired offer' });
        }

        let discountAmount = 0;
        if (offer.type === 'product') {
            // Apply product-specific offer
            cart.products.forEach(product => {
                if (product.productId === offer.productId.toString()) {
                    discountAmount += calculateDiscount(product.price, offer.discountValue, offer.discountType);
                }
            });
        } else if (offer.type === 'category') {
            // Apply category-specific offer
            cart.products.forEach(async product => {
                const productData = await Product.findById(product.productId);
                if (productData.categoryId === offer.categoryId.toString()) {
                    discountAmount += calculateDiscount(product.price, offer.discountValue, offer.discountType);
                }
            });
        }

        res.json({ message: 'Offer applied successfully', discountAmount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error applying offer' });
    }
};

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
    cancelOrder,
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
    applyCoupon,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    getWalletDetails,
    addFunds,
    deductFunds,
    createOrder,
    verifyPayment,
    applyOffer
};