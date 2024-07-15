const mongoose = require('mongoose');
const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderShema');
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
            res.redirect('/');
        });
    } catch (error) {
        console.error('Error logging out:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const HomePage = async (req, res) => {
    try {
        const products = await Product.find();
        return res.render('home', { products, message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

const getShopPage = async (req, res) => {
    try {
        const { page = 1, sort = 'price', minPrice = 0, maxPrice = 1000, categories = [], brands = [] } = req.query;
        const ITEMS_PER_PAGE = 9;

        // Convert categories and brands to arrays if they are not already
        const categoryArray = Array.isArray(categories) ? categories : [categories];
        const brandArray = Array.isArray(brands) ? brands : [brands];

        // Create filter object
        let filter = {
            price: { $gte: minPrice, $lte: maxPrice }
        };
        if (categoryArray.length > 0 && categoryArray[0] !== '') {
            filter.category = { $in: categoryArray };
        }
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
            minPrice,
            maxPrice,
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

        // Save user info to session
        req.session.signupData = { username, email, password: await bcrypt.hash(password, 10) };

        // Save OTP to the database
        await Otp.create({ email, otp: otpCode });

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

        if (otpRecord.otp !== otp) {
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
        if (otpAge > 30) { // 30 seconds TTL
            console.error('OTP expired for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Invalid or expired OTP',
                messageType: 'error'
            });
        }

        // Retrieve signup data from session
        const { username, password } = req.session.signupData;

        if (!username || !password) {
            console.error('Signup data missing from session for email:', email);
            return res.render('otp_page', {
                email,
                message: 'Signup data is missing. Please sign up again.',
                messageType: 'error'
            });
        }

        // Save the new user to the database
        const newUser = new User({ username, email, password, isVerified: true, isBlocked: false  });
        await newUser.save();

        // Delete the OTP record from the database
        await Otp.deleteOne({ email });

        // Clear signup data from session
        req.session.signupData = null;

        // Redirect to login page with success message
        res.redirect('/');
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

        await Otp.findOneAndUpdate(
            { email },
            { otp: otpCode, createdAt: new Date() },
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
                return res.status(500).json({ success:
                    false, message: 'Error sending OTP email' });
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
        res.redirect('/home');
    } catch (error) {
        console.log(error.message);
        res.render('login', { message: 'Internal Server Error', messageType: 'error' });
    }
};


// Get Cart
const getCart = async (req, res) => {
    try {
        const userId = req.session.user.userId; // Extract userId from session
        const page = parseInt(req.query.page, 10) || 1; // Get the current page from the query parameters (default to 1)
        const limit = 5; // Number of items per page
        const skip = (page - 1) * limit; // Calculate the number of items to skip for pagination

        // Fetch the cart for the logged-in user and populate product details
        let cart = await Cart.findOne({ userId }).populate('products.productId');

        if (!cart) {
            // If no cart exists, create a new one with empty products and zero totalPrice
            cart = { products: [], totalPrice: 0 };
        }

        // Paginate products
        const paginatedProducts = cart.products.slice(skip, skip + limit);
        const totalItems = cart.products.length;
        const totalPages = Math.ceil(totalItems / limit);

        // Ensure totalPrice is a number and format it
        cart.totalPrice = parseFloat(cart.totalPrice.toFixed(2));

        // Render the cart view with the cart object and pagination details
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
        // res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

// Add to Cart
const addToCart = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const productId = req.body.productId;
        const quantity = parseInt(req.body.quantity, 10) || 1; // Ensure quantity is an integer

        let cart = await Cart.findOne({ userId });

        if (cart) {
            // Check if product already exists in cart
            const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
            if (productIndex > -1) {
                // Update quantity
                cart.products[productIndex].quantity += quantity;
            } else {
                // Add new product to cart
                cart.products.push({ productId, quantity });
            }
        } else {
            // Create new cart for user
            cart = new Cart({ userId, products: [{ productId, quantity }] });
        }

        // Fetch the product price
        const product = await Product.findById(productId);
        const productPrice = product ? product.price : 0;

        // Recalculate total price
        cart.totalPrice = cart.products.reduce((total, item) => {
            return total + (productPrice * item.quantity);
        }, 0);

        // Save the updated cart
        await cart.save();

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

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user?.userId;

        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate('products.productId');
        const user = await User.findById(userId);

        if (!cart || cart.products.length === 0) {
            return res.render('checkout', { message: 'Your cart is empty', messageType: 'error', cart: null, user });
        }

        res.render('checkout', { message: null, messageType: null, cart, user });
    } catch (error) {
        console.error('Error fetching checkout page:', error.message);
        res.status(500).send('Internal Server Error');
    }
};



const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user?.userId;

        if (!userId) {
            throw new Error('User is not authenticated');
        }

        const { shippingAddressId, orderNotes, paymentMethod } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty' });
        }

        const selectedShippingAddress = user.addresses.id(shippingAddressId);
        if (!selectedShippingAddress) {
            return res.status(400).json({ message: 'Shipping address not found' });
        }

        const totalPrice = cart.products.reduce((total, item) => {
            const product = item.productId;
            return total + (product.price * item.quantity);
        }, 0);

        const order = new Order({
            userId,
            products: cart.products.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity
            })),
            shippingAddressId,
            totalPrice,
            paymentMethod,
            orderNotes,
            status: 'Pending',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await order.save();
        await Cart.deleteOne({ userId });

        res.json({ orderId: order._id });
    } catch (error) {
        console.error('Error placing order:', error.message);
        res.status(500).json({ message: `Error placing order: ${error.message}` });
    }
};



const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log('Order ID:', orderId); // Log the orderId to check its value

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).render('orderConfirm', { order: null, message: 'Invalid order ID', messageType: 'error' });
        }

        const order = await Order.findById(orderId).populate('products.productId');

        if (!order) {
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
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).render('orderConfirm', { order: null, message: 'Order not found', messageType: 'error' });
        }

        if (order.status !== 'Pending') {
            return res.status(400).render('orderConfirm', { order, message: 'Only pending orders can be cancelled', messageType: 'error' });
        }

        order.status = 'Cancelled';
        order.updatedAt = new Date();
        await order.save();

        res.redirect(`/orderConfirm/${orderId}`);
    } catch (error) {
        console.error('Error cancelling order:', error.message);
        res.status(500).render('orderConfirm', { order: null, message: 'Error cancelling order. Please try again.', messageType: 'error' });
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
        const orders = await Order.find({ userId: req.session.user?.userId}).populate('products.productId');

        const ordersWithProductDetails = orders.map(order => {
            order.products = order.products.map(product => ({
                name: product.productId.name,
                images: product.productId.images,
                price: product.productId.price,
                quantity: product.quantity
            }));
            return order;
        });

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
    getOrderDetails,
    cancelOrder,
    getaddresPage,
    addAddress,
    editAddress,
    deleteAddress,
    getEditAddressPage,
    getOrderListing,
    updateProfile
};