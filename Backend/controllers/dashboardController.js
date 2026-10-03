const Meal = require('../models/Meal');

// Get last 7 days dashboards
const getDashboard = async (req,res) => {
    try{
        const today = new Date();
        const endDate = new Date(today);
        endDate.setHours(23,59,59,999);

        //Date before 7 days
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0,0,0,0);
        
        //Get all meals for the last 7 days
        const meals = await Meal.find({
            user: req.user._id,
            date: {
                $gte: startDate,
                $lte: endDate
            }
        }).sort({date: -1})
        
        const calorieTarget = calculateCalorieTarget(req.user);
        const targets = calculateNutritionTargets(req.user);

        const days = [];
        
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(today);
            currentDate.setDate(currentDate.getDate() - i);

            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');

            const dateString = `${year}-${month}-${day}`;

            const dayMeals = meals.filter(meal => {
                const mealDate = new Date(meal.date);

                return (
                    mealDate.getFullYear() === year &&
                    mealDate.getMonth() + 1 === currentDate.getMonth() + 1 &&
                    mealDate.getDate() === currentDate.getDate()
                );
            });

            // Calculate nutrition
            let calories = 0;
            let protein = 0;
            let carbs = 0;
            let fat = 0;

            let vitaminA = 0;
            let vitaminC = 0;
            let vitaminD = 0;
            let vitaminB12 = 0;

            let calcium = 0;
            let iron = 0;
            let magnesium = 0;
            let potassium = 0;

            dayMeals.forEach(meal => {
                calories += meal.nutrition.calories || 0;
                protein += meal.nutrition.protein || 0;
                carbs += meal.nutrition.carbs || 0;
                fat += meal.nutrition.fat || 0;

                vitaminA += meal.nutrition.vitamins?.vitaminA || 0;
                vitaminC += meal.nutrition.vitamins?.vitaminC || 0;
                vitaminD += meal.nutrition.vitamins?.vitaminD || 0;
                vitaminB12 += meal.nutrition.vitamins?.vitaminB12 || 0;

                calcium += meal.nutrition.minerals?.calcium || 0;
                iron += meal.nutrition.minerals?.iron || 0;
                magnesium += meal.nutrition.minerals?.magnesium || 0;
                potassium += meal.nutrition.minerals?.potassium || 0;
            });

            days.push({
                date: dateString,
                isToday: i === 0,

                calories: calculateProgress(
                    calories,
                    targets.calories
                ),

                protein: calculateProgress(
                    protein,
                    targets.protein
                ),

                carbs: calculateProgress(
                    carbs,
                    targets.carbs
                ),

                fat: calculateProgress(
                    fat,
                    targets.fat
                ),

                vitamins: {
                    vitaminA: calculateProgress(
                        vitaminA,
                        targets.vitamins.vitaminA
                    ),

                    vitaminC: calculateProgress(
                        vitaminC,
                        targets.vitamins.vitaminC
                    ),

                    vitaminD: calculateProgress(
                        vitaminD,
                        targets.vitamins.vitaminD
                    ),

                    vitaminB12: calculateProgress(
                        vitaminB12,
                        targets.vitamins.vitaminB12
                    )
                },

                minerals: {
                    calcium: calculateProgress(
                        calcium,
                        targets.minerals.calcium
                    ),

                    iron: calculateProgress(
                        iron,
                        targets.minerals.iron
                    ),

                    magnesium: calculateProgress(
                        magnesium,
                        targets.minerals.magnesium
                    ),

                    potassium: calculateProgress(
                        potassium,
                        targets.minerals.potassium
                    )
                },

                mealsCount: dayMeals.length
            });
        }

        res.status(200).json({
            success: true,
            days
        });

    }catch(err){
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard.',
            error: err.message
        })
    }
}

const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);

    let age = today.getFullYear() - birth.getFullYear();

    const monthDifference = today.getMonth() - birth.getMonth();

    if (
        monthDifference < 0 ||
        (monthDifference === 0 && today.getDate() < birth.getDate())
    ) {
        age--;
    }

    return age;
};

const calculateCalorieTarget = (user) => {
    const age = calculateAge(user.birthDate);

    const weight = user.weight.value;
    const height = user.height.value;

    let bmr;

    if (user.height.unit === 'in') {
        const heightCm = height * 2.54;

        bmr = user.gender === 'male'
            ? (10 * weight) + (6.25 * heightCm) - (5 * age) + 5
            : (10 * weight) + (6.25 * heightCm) - (5 * age) - 161;

    } else {
        bmr = user.gender === 'male'
            ? (10 * weight) + (6.25 * height) - (5 * age) + 5
            : (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }


    const activityFactors = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
    };

    const activityFactor =
        activityFactors[user.activityLevel] || 1.2;


    let calories = bmr * activityFactor;


    if (user.goal === 'lose_weight') {
        calories -= 500;
    }

    if (user.goal === 'gain_weight') {
        calories += 300;
    }


    return Math.round(calories);
};
const calculateNutritionTargets = (user) => {

    const age = calculateAge(user.birthDate);

    /*
    =========================
    CALORIES
    =========================
    */

    const weight = user.weight.value;

    let height = user.height.value;

    if (user.height.unit === 'in') {
        height = height * 2.54;
    }

    let bmr;

    if (user.gender === 'male') {
        bmr =
            (10 * weight) +
            (6.25 * height) -
            (5 * age) +
            5;
    } else {
        bmr =
            (10 * weight) +
            (6.25 * height) -
            (5 * age) -
            161;
    }


    const activityFactors = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
    };


    const activityFactor =
        activityFactors[user.activityLevel] || 1.2;


    let calories = bmr * activityFactor;


    if (user.goal === 'lose_weight') {
        calories -= 500;
    }

    if (user.goal === 'gain_weight') {
        calories += 300;
    }


    calories = Math.round(calories);


    /*
    =========================
    MACROS
    =========================
    */

    let protein;

    if (user.goal === 'lose_weight') {
        protein = weight * 2;
    } else {
        protein = weight * 1.6;
    }


    const fatCalories = calories * 0.25;

    const fat = fatCalories / 9;


    const proteinCalories = protein * 4;

    const carbsCalories =
        calories - proteinCalories - fatCalories;

    const carbs = carbsCalories / 4;


    /*
    =========================
    VITAMINS
    =========================
    */

    let vitamins;

    if (user.gender === 'male') {

        vitamins = {
            vitaminA: 900,
            vitaminC: 90,
            vitaminD: 15,
            vitaminB12: 2.4
        };

    } else {

        vitamins = {
            vitaminA: 700,
            vitaminC: 75,
            vitaminD: 15,
            vitaminB12: 2.4
        };

    }


    /*
    =========================
    MINERALS
    =========================
    */

    let minerals;

    if (user.gender === 'male') {

        minerals = {
            calcium: 1000,
            iron: age >= 19 ? 8 : 11,
            magnesium: 400,
            potassium: 3400
        };

    } else {

        minerals = {
            calcium: 1000,
            iron: age >= 19 ? 18 : 15,
            magnesium: 310,
            potassium: 2600
        };

    }


    return {

        calories,

        protein: Number(protein.toFixed(2)),
        carbs: Number(carbs.toFixed(2)),
        fat: Number(fat.toFixed(2)),

        vitamins,

        minerals

    };
};
const calculateProgress = (consumed, target) => {

    const percentage = (consumed / target) * 100;

    return {
        consumed: Number(consumed.toFixed(2)),
        target: Number(target.toFixed(2)),
        percentage: Number(Math.min(percentage, 100).toFixed(2)),
        remaining: Number(
            Math.max(target - consumed, 0).toFixed(2)
        )
    };
};
module.exports = {
    getDashboard
}