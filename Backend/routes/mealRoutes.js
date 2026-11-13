const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/authMiddleware');

const {
    saveReviewedMeal,
    analyzeMealWithIngredients,
    analyzeMealByImage,
    getMeals,
    deleteMeal
} = require('../controllers/mealController');

// Analyze ingredients - no saving
router.post(
    '/analyzeIngredients',
    authMiddleware,
    analyzeMealWithIngredients
);

// Analyze image - no saving
router.post(
    '/analyzeImage',
    authMiddleware,
    upload.single('photo'),
    analyzeMealByImage
);

// Save reviewed meal
router.post(
    '/saveReviewedMeal',
    authMiddleware,
    upload.single('photo'),
    saveReviewedMeal
);

// Get meals
router.get(
    '/getMeals',
    authMiddleware,
    getMeals
);

// Delete meal
router.delete(
    '/:id',
    authMiddleware,
    deleteMeal
);

module.exports = router;
