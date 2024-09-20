const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

// Set up multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for processing

const upload = multer({ storage: storage });

// Middleware to process images
const processImages = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        // If no files are uploaded, move on without changing images
        return next();
    }

    const promises = req.files.map(async (file) => {
        const fileName = `${Date.now()}-${file.originalname}`;
        const outputPath = path.join(__dirname, '../public/user_assets/imgs/shop', fileName);

        // Process and crop the image
        await sharp(file.buffer)
            .resize(300, 300) // Resize to desired dimensions
            .toFile(outputPath); // Save to output path

        return fileName; // Return the new filename
    });

    req.body.images = await Promise.all(promises); // Store filenames in req.body.images
    next(); // Move to the next middleware
};

module.exports = { upload, processImages };
