const User = require('../models/userModel');
const Otp = require('../models/otp_model');
const Product = require('../models/productModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');

const Admin_login = async (req, res) => {
    try {
        return res.render('admin_login');
    } catch (error) {
        console.log(error.message);
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
        const images = req.files.map(file => file.filename); // Assuming images are uploaded using multer

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
const Admin_category = async (req, res) => {
    try {
        return res.render('catagoryManagement');
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const Admin_user = async (req, res) => {
    try {
        return res.render('userManagement');
    } catch (error) {
        console.log(error.message);
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
    Admin_category,
    Admin_user
};
