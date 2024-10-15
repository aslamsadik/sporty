require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const session = require('express-session');
const qs = require('qs');


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

// Middleware to parse URL-encoded bodies using qs
app.use(express.urlencoded({
    extended: true,
    parameterLimit: 10000,
    limit: '50mb',
    parse: function (str) {
        return qs.parse(str, { allowDots: true });
    }
}));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    connectTimeoutMS: 30000, // 30 seconds
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Other configurations and routes
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const userRoute = require('./routes/userRoutes');
app.use('/', userRoute);

const adminRoute = require('./routes/adminRoutes');
app.use('/admin', adminRoute);

app.listen(5000, () => {
    console.log('Server running on port 5000');
});
