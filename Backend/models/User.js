const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    //Account Info
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },
    
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    token: {
      type: String,
      unique: true,
      sparse: true
    },
    //Personal Info

    birthDate: {
      type: Date,
      required: true
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true
    },
    
    //Body Info

    height: {
      value: {
        type: Number,
        required: true
      },
      unit: {
        type: String,
        enum: ["cm", "in"],
        required: true
      }
    },
    
    weight: {
      value: {
        type: Number,
        required: true
      },
      unit: {
        type: String,
        enum: ["kg", "lb"],
        required: true
      }
    },
    
    //User Goal
    goal: {
      type: String,
      enum: ["lose_weight", "maintain_weight", "gain_weight"],
      required: true
    },

    activityLevel: {
      type: String,
      enum: [
        "sedentary",
        "light",
        "moderate",
        "active",
        "very_active"
      ],
      required: true
    },
    
    //User Preference
    dietType: {
      type: String,
      enum: ["vegetarian", "meat_eater"],
      required: true
    },

    dislikedFoods: {
      type: [String],
      default: []
    },

    //Health
    healthNotes: {
      type: String,
      default: ""
    },
    
    //Gamification
    xp: {
      type: Number,
      default: 0
    },

    level: {
      type: Number,
      default: 1
    },

    streak: {
      type: Number,
      default: 0
    }
})

const User = mongoose.model("User", userSchema);
module.exports = User;