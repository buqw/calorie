const Meal = require('../models/Meal')

//Adding meals with nutritions
const addMealWithNutritions = async (req,res) => {
    try{
        const {
            name,
            mealType,
            nutrition
        } = req.body;

        // Validate meal info
        if(
            !name ||
            !mealType ||
            !nutrition
        ){
            return res.status(400).json({
                message: 'Name, meal type and nutrition are required.'
            })
        }
        //Adding meal
        const meal = await Meal.create({
            user: req.user._id,
            name,
            mealType,
            nutrition
        })

        res.status(201).json({
            message: 'Meal added successfully',
            meal
        })

    }catch(err){
        res.status(500).json({
            message: 'Failed to add meal',
            error: err.message
        })
    }
}

const getMeals = async (req, res) => {
    try{
        const meals = await Meal.find({
            user: req.user._id
        }).sort({date: -1})

        res.status(200).json({
            meals
        })
    }catch(err){
        res.status(500).json({
            message: 'Cannot get meals.',
            error: err.message
        })
    }
}

const deleteMeal = async (req, res) => {
    try{
        const meal = await Meal.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        })

        if(!meal){
            return res.status(404).json({
                message: 'Meal not found.'
            })
        }

        res.status(200).json({
            message: 'Meal deleted successfully.'
        })
    }catch(err){
        res.status(500).json({
            message: 'Failed to delete meal.',
            error: err.message
        })
    }
}
module.exports = {
    addMealWithNutritions,
    getMeals,
    deleteMeal
}