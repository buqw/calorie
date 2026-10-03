const express = require('express')
const router = express.Router();
const upload = require('../middleware/upload')
const authMiddleware = require('../middleware/authMiddleware')

//Controllers
const {
    addMealWithNutritions,
    addMealWithIngredients,
    addMealByImage,
    getMeals,
    deleteMeal
} = require('../controllers/mealController')

                        //Routes

// add meal by nutritions
router.post(
    '/addByNutrition',
    authMiddleware,
    addMealWithNutritions
)

// Add meal by Ingredients
router.post(
    '/addByIngredients',
    authMiddleware,
    addMealWithIngredients
)

// Add meal by image
router.post(
    '/addByImage',
    authMiddleware,
    upload.single('image'),
    addMealByImage
)

//Get meals of a user
router.get('/getMeals',
    authMiddleware,
    getMeals
)

// Delete meal
router.delete(
    '/:id', 
    authMiddleware, 
    deleteMeal
)


module.exports = router