const express = require('express')
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware')

//Controllers
const {
    addMealWithNutritions,
    getMeals,
    deleteMeal
} = require('../controllers/mealController')

                        //Routes

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
// add meal by nutritions
router.post(
    '/addByNutrition',
    authMiddleware,
    addMealWithNutritions
)

module.exports = router