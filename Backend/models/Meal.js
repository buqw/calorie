const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mealSchema = new Schema({
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack", "other"],
      required: true
    },

    ingredients: [
      {
        name: {
          type: String,
          required: true
        },
        amount: {
          type: Number
        },
        unit: {
          type: String
        }
      }
    ],

    nutrition: {
      calories: {
        type: Number,
        required: true,
        min: 0
      },

      protein: {
        type: Number,
        min: 0
      },

      carbs: {
        type: Number,
        min: 0
      },

      fat: {
        type: Number,
        min: 0
      },

      vitamins: {
        vitaminA: Number,
        vitaminC: Number,
        vitaminD: Number,
        vitaminB12: Number
      },

      minerals: {
        calcium: Number,
        iron: Number,
        magnesium: Number,
        potassium: Number
      }
    },

    image: {
      type: String
    },

    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('meal',mealSchema);