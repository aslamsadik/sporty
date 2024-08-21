// routes/adminRoutes.js
const express = require('express');
const Admin_router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdminAuthenticated, isAdminNotAuthenticated } = require('../middlewares/middleware');
const upload = require('../config/multerConfig'); // Import the multer configuration

// Admin login and logout
Admin_router.get('/login', isAdminNotAuthenticated, adminController.Admin_login);
Admin_router.post('/login', isAdminNotAuthenticated, adminController.Admin_loginFunction);
Admin_router.get('/logout', isAdminAuthenticated, adminController.Admin_logout);

// Admin home
Admin_router.get('/admin_home', isAdminAuthenticated, adminController.Admin_home);

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

//coupen ,anagement
Admin_router.get('/addCouponPage', adminController.getAddCouponPage);
Admin_router.post('/addCoupon', adminController.addCoupon);
Admin_router.get('/couponList', adminController.getCouponList);
Admin_router.get('/editCoupon/:id', adminController.getEditCouponPage);
Admin_router.post('/editCoupon/:id', adminController.editCoupon);
Admin_router.post('/deleteCoupon/:id', adminController.deleteCoupon);

// Offer management routes
Admin_router.get('/offers', adminController.addOfferPage);

// Route to handle form submission for creating a new offer
Admin_router.post('/offers', adminController.createOffer);

// Route to display offer edit page
Admin_router.get('/offers/:id/edit', adminController.editOffers);

// Route to handle form submission for updating an existing offer
Admin_router.post('/offers/:id/edit', adminController.updateOffer);

// Route to list all offers
Admin_router.get('/offersList', adminController.listOffers);




module.exports = Admin_router;

