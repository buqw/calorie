const Meal = require('../models/Meal');
const { addXP } = require('../utils/gamification');
const OpenAI = require('openai');
const sharp = require('sharp');

const client = new OpenAI({
    apiKey: process.env.OpenAi_Key
});

// Parse JSON fields (useful for FormData requests)
const parseJSONField = (value) => {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

// Optimize image before saving
const optimizeImage = async (file) => {
    const imageBuffer = await sharp(file.buffer)
        .resize({
            width: 768,
            height: 768,
            fit: 'inside'
        })
        .jpeg({ quality: 70 })
        .toBuffer();

    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
};

// ==========================================
// Save reviewed meal
// ==========================================

const saveReviewedMeal = async (req, res) => {
    try {
        const { name, mealType, method } = req.body;

        const nutrition = parseJSONField(req.body.nutrition);
        const ingredients = parseJSONField(req.body.ingredients);

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            !mealType ||
            !nutrition
        ) {
            return res.status(400).json({
                success: false,
                message: 'Name, meal type and nutrition are required.'
            });
        }

        if (!['nutrition', 'ingredients', 'photo'].includes(method)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid meal method.'
            });
        }

        // Check ingredients for AI methods
        if (
            (method === 'ingredients' || method === 'photo') &&
            (
                !Array.isArray(ingredients) ||
                ingredients.length === 0 ||
                ingredients.some(item =>
                    !item ||
                    typeof item.name !== 'string' ||
                    !item.name.trim()
                )
            )
        ) {
            return res.status(400).json({
                success: false,
                message: 'Valid meal ingredients are required.'
            });
        }

        // Check image for Photo method
        if (method === 'photo' && !req.file) {
            return res.status(400).json({
                success: false,
                message: 'Meal photo is required.'
            });
        }

        // Validate nutrition values
        const nutritionFields = [
            nutrition.calories,
            nutrition.protein,
            nutrition.carbs,
            nutrition.fat
        ];

        if (
            !nutritionFields.every(value =>
                typeof value === 'number' &&
                Number.isFinite(value) &&
                value >= 0
            )
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid nutrition values.'
            });
        }

        // Build meal data
        const mealData = {
            user: req.user._id,
            name: name.trim(),
            mealType,
            nutrition
        };

        // Save ingredients only for AI methods
        if (method === 'ingredients' || method === 'photo') {

            const formattedIngredients = ingredients.map(item => {
                const amount = Number(
                    item.amount ?? item.quantity ?? 0
                );

                return {
                    name: item.name.trim(),
                    amount,
                    unit: typeof item.unit === 'string'
                        ? item.unit.trim()
                        : ''
                };
            });

            // Validate ingredient amounts
            const invalidAmount = formattedIngredients.some(item =>
                !Number.isFinite(item.amount) ||
                item.amount < 0
            );

            if (invalidAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Ingredient amounts must be valid non-negative numbers.'
                });
            }

            mealData.ingredients = formattedIngredients;
        }

        // Save image only for Photo method
        if (method === 'photo') {
            mealData.image = await optimizeImage(req.file);
        }

        const meal = await Meal.create(mealData);

        // Add XP
        addXP(req.user._id, 10).catch(err => {
            console.log('Failed to update XP:', err.message);
        });

        return res.status(201).json({
            success: true,
            message: 'Meal added successfully.',
            meal
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: 'Failed to save meal.',
            error: err.message
        });
    }
};

// ==========================================
// Analyze meal using ingredients
// ==========================================

const analyzeMealWithIngredients = async (req, res) => {
    try {
        const { text, ingredients } = req.body;

        let mealDescription = text;

        // Validate ingredients before sending to AI
        if (ingredients !== undefined) {

            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ingredients must be a non-empty array.'
                });
            }

            const invalidIngredient = ingredients.some(item => {
                if (
                    !item ||
                    typeof item.name !== 'string' ||
                    !item.name.trim()
                ) {
                    return true;
                }

                const amount = item.quantity ?? item.amount;

                if (amount !== undefined && amount !== '') {
                    const numericAmount = Number(amount);

                    if (
                        !Number.isFinite(numericAmount) ||
                        numericAmount < 0
                    ) {
                        return true;
                    }
                }

                return false;
            });

            if (invalidIngredient) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ingredient data.'
                });
            }

            mealDescription = ingredients.map(item =>
                `${item.name.trim()}, amount: ${item.quantity ?? item.amount ?? ''} ${item.unit ?? ''}`
            ).join('\n');
        }

        if (
            typeof mealDescription !== 'string' ||
            !mealDescription.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: 'Meal description is required.'
            });
        }

        const response = await client.responses.create({
            model: 'gpt-5-mini',
            input: `
                You are a nutrition assistant for a calorie tracking application.

                Analyze the meal described by the user.

                User meal:
                ${mealDescription}

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
        });

        const aiResult = JSON.parse(response.output_text);

        return res.status(200).json({
            success: true,
            name: aiResult.name,
            ingredients: aiResult.ingredients,
            nutrition: aiResult.nutrition
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: 'Failed to analyze meal.',
            error: err.message
        });
    }
};

// ==========================================
// Analyze meal using image
// ==========================================

const analyzeMealByImage = async (req, res) => {
    try {
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
            .jpeg({ quality: 70 })
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
                            text: `
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

        return res.status(200).json({
            success: true,
            name: aiResult.name,
            ingredients: aiResult.ingredients,
            nutrition: aiResult.nutrition
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: 'Failed to analyze meal image.',
            error: err.message
        });
    }
};

// ==========================================
// Get all meals for logged-in user
// ==========================================

const getMeals = async (req, res) => {
    try {
        const meals = await Meal.find({
            user: req.user._id
        }).sort({ date: -1 });

        return res.status(200).json({
            meals
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            message: 'Cannot get meals.',
            error: err.message
        });
    }
};

// ==========================================
// Delete meal by ID
// ==========================================

const deleteMeal = async (req, res) => {
    try {
        const meal = await Meal.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        if (!meal) {
            return res.status(404).json({
                message: 'Meal not found.'
            });
        }

        // Remove XP
        addXP(req.user._id, -10).catch(err => {
            console.log('Failed to update XP:', err.message);
        });

        return res.status(200).json({
            message: 'Meal deleted successfully.'
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            message: 'Failed to delete meal.',
            error: err.message
        });
    }
};

// ==========================================
// Exports
// ==========================================

module.exports = {
    saveReviewedMeal,
    analyzeMealWithIngredients,
    analyzeMealByImage,
    getMeals,
    deleteMeal
};
