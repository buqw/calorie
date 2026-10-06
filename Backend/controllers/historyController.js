const Meal = require('../models/Meal');

const getHistory = async (req, res) => {
  try {
    const { range = '7' } = req.query;

    let startDate = null;

    if (range === '7') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } 
    
    else if (range === '30') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    } 
    
    else if (range !== 'all') {
      return res.status(400).json({
        message: 'Invalid range. Use 7, 30, or all.'
      });
    }

    const filter = {
      user: req.user._id
    };

    if (startDate) {
      filter.date = { $gte: startDate };
    }

    const meals = await Meal.find(filter)
      .sort({ date: -1 });

    const history = {};

    meals.forEach((meal) => {
      const date = meal.date.toISOString().split('T')[0];

      if (!history[date]) {
        history[date] = {
          date,
          day: meal.date.toLocaleDateString('en-US', {
            weekday: 'long'
          }),
          mealCount: 0,
          totalCalories: 0,
          meals: []
        };
      }

      history[date].mealCount += 1;
      history[date].totalCalories += meal.nutrition.calories;

      history[date].meals.push({
        mealType: meal.mealType,
        name: meal.name,
        calories: meal.nutrition.calories,
        protein: meal.nutrition.protein || 0,
        carbs: meal.nutrition.carbs || 0,
        fat: meal.nutrition.fat || 0
      });
    });

    res.status(200).json(
      Object.values(history)
    );

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Failed to get history'
    });
  }
};

module.exports = {
  getHistory
};