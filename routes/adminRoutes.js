// routes/adminRoutes.js
const express = require('express');
const Admin_router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdminAuthenticated, isAdminNotAuthenticated } = require('../middlewares/middleware');
const { upload, processImages } = require('../config/multerConfig'); // Import the multer configuration

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
Admin_router.post('/addProduct', isAdminAuthenticated, upload.array('images', 3),processImages, adminController.Admin_addProduct);
Admin_router.get('/editProduct/:id', isAdminAuthenticated, adminController.Admin_editProductPage);
Admin_router.post('/editProduct/:id', isAdminAuthenticated, upload.array('images', 3),processImages,adminController.Admin_editProduct);
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
// Admin route for approving return
Admin_router.post('/approve-return', isAdminAuthenticated, adminController.approveReturn);
Admin_router.get('/view-order-details/:orderId', isAdminAuthenticated, adminController.viewOrderDetails);

//coupen ,anagement
Admin_router.get('/addCouponPage', adminController.getAddCouponPage);
Admin_router.post('/addCoupon', adminController.addCoupon);
Admin_router.get('/couponList', adminController.getCouponList);
Admin_router.get('/editCoupon/:id', adminController.getEditCouponPage);
Admin_router.post('/editCoupon/:id', adminController.editCoupon);
Admin_router.post('/deleteCoupon/:id', adminController.deleteCoupon);

// Offer Routes
Admin_router.get('/offersList', adminController.getOffers);
Admin_router.post('/offers/add', adminController.addOffer);
Admin_router.get('/offers/:id/edit', adminController.getOfferForEdit);
Admin_router.post('/offers/:id/edit', adminController.editOffer);
Admin_router.get('/offers', adminController.addOfferPage);
Admin_router.post('/offers/delete/:offerId', adminController.deleteOffer);

Admin_router.get('/sales-report', adminController.getSalesReport);
Admin_router.get('/sales-report/export/pdf', adminController.exportSalesReportPDF);
// Export sales report as CSV
Admin_router.get('/sales-report/export/csv', adminController.exportSalesReportCSV);

// Export sales report as Excel
Admin_router.get('/sales-report/export/excel', adminController.exportSalesReportExcel);;




module.exports = Admin_router;