
const express = require('express');
const multer = require('multer');

const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { chatbot } = require('../controllers/ChatbotController');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG and WebP images are allowed.'));
        }
    }
});

router.post(
    '/',
    authMiddleware,
    upload.single('image'),
    chatbot
);

module.exports = router;
