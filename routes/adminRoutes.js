const express = require('express');
const Admin_router = express.Router();
const adminController = require('../controllers/adminController');
const path = require('path');
const multer = require('multer');
const { isAdminAuthenticated, isAdminNotAuthenticated } = require('../middlewares/middleware');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/user_assets/imgs/shop')); // Path to the uploads folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Ensure unique filenames
    }
});

const upload = multer({ storage: storage });

// Admin login and logout
Admin_router.get('/login', isAdminNotAuthenticated, adminController.Admin_login);
Admin_router.post('/login', isAdminNotAuthenticated, adminController.Admin_loginFunction);
Admin_router.get('/logout', isAdminAuthenticated, adminController.Admin_logout);

// Admin home
Admin_router.get('/Admin_home', isAdminAuthenticated, adminController.Admin_home);

// User Management
Admin_router.get('/userManagement', isAdminAuthenticated, adminController.Admin_userList);
Admin_router.post('/toggleBlockUser/:id', isAdminAuthenticated, adminController.Admin_toggleBlockUser);

// Product Management
Admin_router.get('/productList', isAdminAuthenticated, adminController.Admin_productList);
Admin_router.get('/productManagement', isAdminAuthenticated, adminController.Admin_addProductPage);
Admin_router.post('/addProduct', isAdminAuthenticated, upload.array('images', 3), adminController.Admin_addProduct);
Admin_router.get('/editProduct/:id', isAdminAuthenticated, adminController.Admin_editProductPage);
Admin_router.post('/editProduct/:id', isAdminAuthenticated, upload.array('images', 3), adminController.Admin_editProduct);
Admin_router.post('/deleteProduct/:id', isAdminAuthenticated, adminController.Admin_deleteProduct);

// Category Management
Admin_router.get('/catagories/catagoryManagement', isAdminAuthenticated, adminController.getCategoryPage);
Admin_router.post('/catagories/add', isAdminAuthenticated, adminController.addCategory);
Admin_router.post('/catagories/edit/:id', isAdminAuthenticated, adminController.editCategory);
Admin_router.post('/catagories/delete/:id', isAdminAuthenticated, adminController.deleteCategory);

// Order Management
Admin_router.get('/orders', isAdminAuthenticated, adminController.getOrderManagementPage);
Admin_router.post('/delete-order', isAdminAuthenticated, adminController.deleteOrder);
Admin_router.post('/update-order-status', isAdminAuthenticated, adminController.updateOrderStatus);
Admin_router.get('/view-order-details/:orderId', isAdminAuthenticated, adminController.viewOrderDetails);

module.exports = Admin_router;
