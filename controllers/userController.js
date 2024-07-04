const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
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
        // Fetch the current page, sort option, minPrice, maxPrice, categories, and brands from query parameters
        const { page = 1, sort = 'popularity', minPrice, maxPrice, categories = '', brands = '' } = req.query;
        const productsPerPage = 9;

        // Prepare filters
        const filters = {};
        const selectedCategories = categories.split(',').filter(cat => cat); // Parse categories query
        const selectedBrands = brands.split(',').filter(brand => brand); // Parse brands query

        if (selectedCategories.length > 0) {
            filters.category = { $in: selectedCategories };
        }
        if (selectedBrands.length > 0) {
            filters.brand = { $in: selectedBrands };
        }
        if (minPrice || maxPrice) {
            filters.price = { $gte: minPrice || 0, $lte: maxPrice || 1000 };
        }

        // Fetch products based on filters, sorting, pagination, etc.
        const products = await Product.find(filters)
            .sort(sort === 'popularity' ? { createdAt: -1 } : 
                  sort === 'price_asc' ? { price: 1 } :
                  sort === 'price_desc' ? { price: -1 } :
                  sort === 'rating' ? { rating: -1 } : { createdAt: -1 })
            .skip((page - 1) * productsPerPage)
            .limit(productsPerPage);

        const totalProducts = await Product.countDocuments(filters);
        const totalPages = Math.ceil(totalProducts / productsPerPage);

        // Fetch latest products
        const latestProducts = await Product.find().sort({ createdAt: -1 }).limit(5);

        // Fetch distinct categories and brands for the sidebar
        const distinctCategories = await Product.distinct('category');
        const distinctBrands = await Product.distinct('brand');

        res.render('shop', {
            products,
            currentPage: parseInt(page),
            totalPages,
            categories: distinctCategories,
            brands: distinctBrands,
            sort,
            minPrice,
            maxPrice,
            selectedCategories,
            selectedBrands,
            latestProducts // Pass latestProducts to the view
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};


// const getShop = async (req, res) => {
//     try {
//         const { search, category, minPrice, maxPrice, sort, page = 1 } = req.query;

//         const query = {};
//         if (search) {
//             query.name = new RegExp(search, 'i'); // Case-insensitive search
//         }
//         if (category) {
//             query.category = category;
//         }
//         if (minPrice) {
//             query.price = { ...query.price, $gte: parseFloat(minPrice) };
//         }
//         if (maxPrice) {
//             query.price = { ...query.price, $lte: parseFloat(maxPrice) };
//         }

//         let sortOption = {};
//         if (sort === 'priceAsc') {
//             sortOption.price = 1;
//         } else if (sort === 'priceDesc') {
//             sortOption.price = -1;
//         } else if (sort === 'popularity') {
//             sortOption.popularity = -1; // Adjust as needed
//         }

//         const products = await Product.find(query).sort(sortOption).skip((page - 1) * 10).limit(10);
//         const totalProducts = await Product.countDocuments(query);
//         const totalPages = Math.ceil(totalProducts / 10);

//         res.render('shop', {
//             products,
//             currentPage: parseInt(page),
//             totalPages,
//             search,
//             category,
//             minPrice,
//             maxPrice,
//             sort,
//             categories: await Category.find() // Fetch categories for filter
//         });
//     } catch (error) {
//         console.error('Error fetching products:', error.message);
//         res.status(500).send('Internal Server Error');
//     }
// };



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

const profilePage = async (req, res) => {
    try {
        return res.render('profile');
    } catch (error) {
        console.log(error.message);
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
    }
};

// const getCart = async (req, res) => {
//     try {
//         return res.render('cart');
//     } catch (error) {
//         console.log(error.message);
//         res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
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
            isAdmin: user.isAdmin,  // Ensure this field exists in the user schema
            isBlocked: user.isBlocked
        };

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
        res.status(500).render('error', { message: 'Internal Server Error', messageType: 'error' });
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


// Remove from Cart
const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const productId = req.body.productId;

        let cart = await Cart.findOne({ userId });

        if (cart) {
            // Filter out the product to remove it from the cart
            cart.products = cart.products.filter(p => p.productId.toString() !== productId);

            // Recalculate total price
            cart.totalPrice = cart.products.reduce(async (total, item) => {
                const product = await Product.findById(item.productId);
                return total + (product ? product.price * item.quantity : 0);
            }, 0);

            // Save the updated totalPrice to the cart
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



const getCheckout = async (req, res) => {
    try {
       res.render('checkout')
    } catch (error) {
        console.error('Error clearing the cart:', error);
        return res.status(500).json({ success: false, message: 'Error clearing the cart' });
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
    profilePage,
    getCart,
    removeFromCart,
    addToCart,
    clearCart,
    getCheckout

};