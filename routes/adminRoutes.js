const express = require('express');
const Admin_router = express.Router();
const adminController = require('../controllers/adminController');
const { isBlockedMiddleware } = require('../middlewares/adminAuth');
const path = require('path'); //  import the path module
const multer=require("multer");


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


Admin_router.get('/userManagement', adminController.Admin_userList);
Admin_router.post('/toggleBlockUser/:id', adminController.Admin_toggleBlockUser);
Admin_router.get('/login', adminController.Admin_login);
Admin_router.get('/home', adminController.Admin_home);
Admin_router.get('/productList', adminController.Admin_productList);
Admin_router.get('/productManagement', adminController.Admin_addProductPage);
Admin_router.post('/addProduct', upload.array('images', 3), adminController.Admin_addProduct);
Admin_router.get('/editProduct/:id', adminController.Admin_editProductPage);
Admin_router.post('/editProduct/:id', upload.array('images', 3), adminController.Admin_editProduct);
Admin_router.post('/deleteProduct/:id', adminController.Admin_deleteProduct);
Admin_router.get('/categoryManagement', adminController.Admin_category);



module.exports = Admin_router;
