const express = require('express')
const router = express.Router();

const {getProfile,
      updateProfile
      } = require('../controllers/profileController')
      
const authMiddleware = require('../middleware/authMiddleware')
const validateProfile = require('../middleware/profileValidation')

router.get('/', authMiddleware, getProfile);
router.put('/', authMiddleware, validateProfile, updateProfile);

module.exports = router