const express = require('express');
const Admin_router = express.Router();
const adminController = require('../controllers/adminController');
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
//product
Admin_router.get('/productList', adminController.Admin_productList);
Admin_router.get('/productManagement', adminController.Admin_addProductPage);
Admin_router.post('/addProduct', upload.array('images', 3), adminController.Admin_addProduct);
Admin_router.get('/editProduct/:id', adminController.Admin_editProductPage);
Admin_router.post('/editProduct/:id', upload.array('images', 3), adminController.Admin_editProduct);
Admin_router.post('/deleteProduct/:id', adminController.Admin_deleteProduct);
// Categories
Admin_router.get('/catagories/catagoryManagement', adminController.getCategoryPage);
Admin_router.post('/catagories/add', adminController.addCategory);
Admin_router.post('/catagories/edit/:id', adminController.editCategory);
Admin_router.post('/catagories/delete/:id', adminController.deleteCategory);


module.exports = Admin_router;
