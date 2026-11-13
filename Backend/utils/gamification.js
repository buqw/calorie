const User = require('../models/User');

const addXP = (userId, amount) => {
    return User.findByIdAndUpdate(
        userId,
        { $inc: { xp: amount } }
    );
};

const getLevelInfo = (xp) => {
    const levels = [
        { level: 1, requiredXP: 0 },
        { level: 2, requiredXP: 100 },
        { level: 3, requiredXP: 250 },
        { level: 4, requiredXP: 450 },
        { level: 5, requiredXP: 700 }
    ];

    let currentLevel = levels[0];

    for (const level of levels) {
        if (xp >= level.requiredXP) {
            currentLevel = level;
        } else {
            break;
        }
    }

    const nextLevel = levels.find(
        level => level.level === currentLevel.level + 1
    );

    return {
        level: currentLevel.level,
        xp,
        xpToNextLevel: nextLevel ? nextLevel.requiredXP : null
    };
};

module.exports = {
    addXP,
    getLevelInfo
};