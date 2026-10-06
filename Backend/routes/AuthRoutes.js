const express = require('express')
const router = express.Router();

const {
    register,
    login,
    forgotPassword,
    verifyResetCode,
    resetPassword
} = require('../controllers/AuthController')

router.post("/register", register);
router.post('/login',login);
router.post('/forgotPassword', forgotPassword);
router.post('/verifyResetCode', verifyResetCode);
router.post('/resetPassword', resetPassword)

module.exports = router;