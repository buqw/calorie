const Meal = require('../models/Meal')
const OpenAI = require('openai')
const sharp = require('sharp')

const client = new OpenAI({
    apiKey: process.env.OpenAi_Key
})

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

// Adding meals with ingredients
const addMealWithIngredients = async (req,res) =>{
    try{
        const {text,mealType} = req.body;

        if(!text){
            return res.status(400).json({
                success: false,
                message: 'Meal description is required.'
            })
        }

        const response = await client.responses.create({
            model: 'gpt-5-mini',
            input:
            `
                You are a nutrition assistant for a calorie tracking application.

                Analyze the meal described by the user.

                User meal:
                ${text}

                Estimate the ingredients and nutritional values based on the information provided.

                Return ONLY valid JSON using exactly this structure:

                {
                "name": "string",
                "ingredients": [
                    {
                    "name": "string",
                    "amount": number,
                    "unit": "string"
                    }
                ],
                "nutrition": {
                    "calories": number,
                    "protein": number,
                    "carbs": number,
                    "fat": number,
                    "vitamins": {
                    "vitaminA": number,
                    "vitaminC": number,
                    "vitaminD": number,
                    "vitaminB12": number
                    },
                    "minerals": {
                    "calcium": number,
                    "iron": number,
                    "magnesium": number,
                    "potassium": number
                    }
                }
                }

                Rules:
                - calories = kcal
                - protein, carbs and fat = grams
                - vitamins and minerals = mg, except vitamin D = micrograms
                - Use reasonable nutritional estimates.
                - If the user does not provide an amount, estimate a reasonable serving size.
                - Do not include explanations.
                - Do not use markdown.
                - Return JSON only.
            `
        })

        const aiResult = JSON.parse(response.output_text);
        const meal = await Meal.create({
            user: req.user._id,
            name: aiResult.name,
            mealType: mealType || 'other',
            ingredients: aiResult.ingredients,
            nutrition: aiResult.nutrition
        })

        res.status(201).json({
            success: true,
            meal 
        })

    }catch(err){
        res.status(500).json({
            success: false,
            message: 'Failed to add meal.',
            error: err.message
        })
    }
}

// Adding meals from image using AI
const addMealByImage = async (req, res) => {
    try {
        const { mealType } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Meal image is required.'
            });
        }

        // Resize and compress image
        const imageBuffer = await sharp(req.file.buffer)
            .resize({
                width: 768,
                height: 768,
                fit: 'inside'
            })
            .jpeg({
                quality: 70
            })
            .toBuffer();

        const base64Image = imageBuffer.toString('base64');

        const response = await client.responses.create({
            model: 'gpt-5-mini',
            reasoning: {
                effort: 'low'
            },
            max_output_tokens: 800,
            input: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: 
                            `
                                Analyze this meal image and return only JSON.
                                
                                {
                                "name": "string",
                                "ingredients": [
                                    {
                                    "name": "string",
                                    "amount": number,
                                    "unit": "string"
                                    }
                                ],
                                "nutrition": {
                                    "calories": number,
                                    "protein": number,
                                    "carbs": number,
                                    "fat": number,
                                    "vitamins": {
                                    "vitaminA": number,
                                    "vitaminC": number,
                                    "vitaminD": number,
                                    "vitaminB12": number
                                    },
                                    "minerals": {
                                    "calcium": number,
                                    "iron": number,
                                    "magnesium": number,
                                    "potassium": number
                                    }
                                }
                                }

                                Ingredient rules:
                                - List only the main ingredients of the meal.
                                - Main ingredients are the foods that make up the meal.
                                - Do NOT list minor ingredients.
                                - Keep the ingredient list short and simple.
                                - The nutrition calculation must still include all ingredients used in the meal,
                                including salt, sugar, oil, butter, spices, sauces, and other minor ingredients.
                                
                                Estimate amounts when unknown.
                                Nutrition values are approximate.
                                No explanations. JSON only.
                            `
                        },
                        {
                            type: 'input_image',
                            image_url: `data:image/jpeg;base64,${base64Image}`,
                            detail: 'low'
                        }
                    ]
                }
            ]
        });

        const aiResult = JSON.parse(response.output_text);

        const meal = await Meal.create({
            user: req.user._id,
            name: aiResult.name,
            mealType: mealType || 'other',
            ingredients: aiResult.ingredients,
            nutrition: aiResult.nutrition
        });

        res.status(201).json({
            success: true,
            meal
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: 'Failed to analyze meal image.'
        });
    }
};


//Send all meals for one user
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
// Delete meal by meal id
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
    addMealWithIngredients,
    addMealByImage,
    getMeals,
    deleteMeal
}