const express = require('express')
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware')
const {
    register,
    login,
    logout,
    forgotPassword,
    verifyResetCode,
    resetPassword
} = require('../controllers/AuthController')

router.post("/register", register);
router.post('/login',login);
router.post('/logout', authMiddleware, logout);
router.post('/forgotPassword', forgotPassword);
router.post('/verifyResetCode', verifyResetCode);
router.post('/resetPassword', resetPassword)

module.exports = router;