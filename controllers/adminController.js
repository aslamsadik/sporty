const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');

const Admin_login = async (req, res) => {
    try {
        return res.render('admin_login',{ message: null, messageType: null });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const Admin_loginFunction=async(req,res)=>{
    try {
        const { email, password } = req.body;
        console.log(email,password);
        // Find the user by email
        const user = await User.findOne({ email });

        // Check if user exists and is an admin
        if (!user || !user.isAdmin || !user.isVerified) {
            return res.render('admin_login', { message: 'Ony admin are allowed to enter', messageType: 'error' });
        }

        // Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('admin_login', { message: 'Invalid email or password', messageType: 'error' });
        }

        // Store user data in session
        req.session.user = { 
            userId: user._id, 
            email: user.email, 
            username: user.username,
            isAdmin: user.isAdmin,
            isBlocked: user.isBlocked
        };

        // Redirect to admin home page
        return res.redirect('/admin/home');
    } catch (error) {
        console.log(error.message);
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
            // Redirect to the login page after logout
            res.redirect('/');
        });
    } catch (error) {
        console.error('Error logging out:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const Admin_home = async (req, res) => {
    try {
        return res.render('dashboard');
    } catch (error) {
        console.log(error.message);
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
        const { name, description, price, brand, category } = req.body;
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

        const newProduct = new Product({ name, description, price, brand, category, images });
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


const Admin_editProduct = async (req, res) => {
    try {
        const { name, description, price, brand, category } = req.body;
        const productId = req.params.id;
        const images = req.files ? req.files.map(file => file.filename) : [];

        // Find the product to update
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect('/admin/productList?message=Product not found&messageType=error');
        }

        // Check if a product with the same name already exists, excluding the current product
        const existingProduct = await Product.findOne({ name, _id: { $ne: productId } });
        if (existingProduct) {
            return res.redirect(`admin/editProduct/${productId}?message=Product with the same name already exists.&messageType=error`);
        }

        // Check if the category exists
        const validCategory = await Category.findOne({ name: category });
        if (!validCategory) {
            return res.redirect(`admin/editProduct/${productId}?message=Category does not exist.&messageType=error`);
        }

        // Update the product details
        product.name = name;
        product.description = description;
        product.price = price;
        product.brand = brand;
        product.category = category;
        if (images.length > 0) {
            product.images = images;
        }

        await product.save();
        res.redirect('/admin/productList?message=Product updated successfully.&messageType=success');
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
    Admin_logout
};