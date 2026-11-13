const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getHistory
} = require('../controllers/historyController');

router.get(
    '/',
    authMiddleware,
    getHistory
)

module.exports = router;