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
        const products = await Product.find();
        return res.render('productList', { products });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const Admin_addProductPage = async (req, res) => {
    try {
        return res.render('productManagement');
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const Admin_addProduct = async (req, res) => {
    try {
        const { name, description, price, brand, category } = req.body;
        const images = req.files.map(file => file.filename);

        if (images.length > 3) {
            return res.status(400).send('You can upload a maximum of 3 images per product.');
        }

        const newProduct = new Product({ name, description, price, brand, category, images });
        await newProduct.save();

        res.redirect('/admin/productList');
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};


const Admin_editProductPage = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        return res.render('editProduct', { product });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const Admin_editProduct = async (req, res) => {
    try {
        const { name, description, price, brand, category } = req.body;
        const product = await Product.findById(req.params.id);

        if (req.files.length > 0) {
            product.images = req.files.map(file => file.filename);
        }

        product.name = name;
        product.description = description;
        product.price = price;
        product.brand = brand;
        product.category = category;

        await product.save();

        res.redirect('/admin/productList');
    } catch (error) {
        console.log(error.message);
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
        res.render('catagoryManagement', { categories });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};


// List Users
const Admin_userList = async (req, res) => {
    try {
        const users = await User.find();
        res.render('userManagement', { users });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
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