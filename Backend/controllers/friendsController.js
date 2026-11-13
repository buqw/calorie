
const mongoose = require('mongoose');

const User = require('../models/User');
const Meal = require('../models/Meal');
const FriendRequest = require('../models/FriendRequest');

const { calculateNutritionTargets } = require('./dashboardController');
const { getLevelInfo } = require('../utils/gamification');



// Get Today's Date Range


const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return { start, end };
};


// Calculate Nutrition

const calculateConsumed = (meals) => {

    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    meals.forEach(meal => {
        nutrition.calories += meal.nutrition.calories || 0;
        nutrition.protein += meal.nutrition.protein || 0;
        nutrition.carbs += meal.nutrition.carbs || 0;
        nutrition.fat += meal.nutrition.fat || 0;
    });

    return nutrition;
};


// Calculate Streak
// Same logic as Dashboard

const calculateStreak = (meals) => {

    const today = new Date();

    const daysWithMeals = new Set();

    meals.forEach(meal => {

        const date = new Date(meal.date);

        const key = [
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        ].join('-');

        daysWithMeals.add(key);
    });

    let streak = 0;

    for (let i = 0; i < 7; i++) {

        const date = new Date(today);
        date.setDate(date.getDate() - i);

        const key = [
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        ].join('-');

        if (daysWithMeals.has(key)) {
            streak++;
        } else {
            if (i === 0) continue;
            break;
        }
    }

    return streak;
};



//  Get Friend's Daily Data

const getFriendData = async (friend) => {

    const { start, end } = getTodayRange();

    const meals = await Meal.find({
        user: friend._id,
        date: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0) - 6 * 24 * 60 * 60 * 1000),
            $lte: end
        }
    });

    const todayMeals = meals.filter(meal => {
        const date = new Date(meal.date);

        return date >= start && date <= end;
    });

    const consumed = calculateConsumed(todayMeals);
    const targets = calculateNutritionTargets(friend);

    return {
        streak: calculateStreak(meals),

        calories: {
            consumed: consumed.calories,
            target: targets.calories
        }
    };
};


// =====================================
// GET: My Friends
// =====================================

const getFriends = async (req, res) => {

    try {

        const user = await User.findById(req.user._id)
            .populate(
                'friends',
                'username birthDate gender height weight goal activityLevel xp'
            );

        const friends = await Promise.all(
            user.friends.map(async friend => {

                const data = await getFriendData(friend);

                return {
                    id: friend._id.toString(),
                    name: friend.username,
                    username: friend.username,
                    streak: data.streak,
                    calories: data.calories
                };

            })
        );

        res.status(200).json({
            success: true,
            friends
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: 'Failed to get friends.',
            error: err.message
        });

    }
};


// =====================================
// GET: Incoming Friend Requests
// =====================================

const getFriendRequests = async (req, res) => {

    try {

        const requests = await FriendRequest.find({
            receiver: req.user._id,
            status: 'pending'
        })
        .populate('sender', 'username')
        .sort({ createdAt: -1 });

        const result = requests.map(request => ({
            id: request._id.toString(),
            name: request.sender.username,
            username: request.sender.username
        }));

        res.status(200).json({
            success: true,
            requests: result
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: 'Failed to get friend requests.',
            error: err.message
        });

    }
};


// =====================================
// GET: Search Users
// =====================================

const searchUsers = async (req, res) => {
    try {

        const username = req.query.username?.trim();

        if (!username || username.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid username.'
            });
        }

        const currentUser = await User.findById(req.user._id)
            .select('friends');

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Get pending friend requests in both directions
        const requests = await FriendRequest.find({
            status: 'pending',
            $or: [
                { sender: req.user._id },
                { receiver: req.user._id }
            ]
        }).select('sender receiver');

        // Exclude current user, existing friends, and pending requests
        const excludedIds = [
            req.user._id,
            ...currentUser.friends
        ];

        requests.forEach(request => {
            const otherUserId =
                request.sender.toString() === req.user._id.toString()
                    ? request.receiver
                    : request.sender;

            excludedIds.push(otherUserId);
        });

        // Escape regex special characters
        const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const users = await User.find({
            username: {
                $regex: escaped,
                $options: 'i'
            },
            _id: {
                $nin: excludedIds
            }
        })
        .select('username')
        .limit(20);

        res.status(200).json({
            success: true,
            users: users.map(user => ({
                id: user._id.toString(),
                name: user.username,
                username: user.username
            }))
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: 'Failed to search users.',
            error: err.message
        });

    }
};


// =====================================
// POST: Send Friend Request
// =====================================

const sendFriendRequest = async (req, res) => {

    try {

        const { userId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID.'
            });
        }

        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot add yourself.'
            });
        }

        const receiver = await User.findById(userId);

        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (req.user.friends.some(id => id.toString() === userId)) {
            return res.status(400).json({
                success: false,
                message: 'You are already friends.'
            });
        }

        const existingRequest = await FriendRequest.findOne({
            $or: [
                {
                    sender: req.user._id,
                    receiver: userId
                },
                {
                    sender: userId,
                    receiver: req.user._id
                }
            ],
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'A friend request already exists.'
            });
        }

        await FriendRequest.create({
            sender: req.user._id,
            receiver: userId
        });

        res.status(201).json({
            success: true,
            message: 'Friend request sent successfully.'
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: 'Failed to send friend request.',
            error: err.message
        });

    }
};


// =====================================
// POST: Friend Actions
// accept / decline / remove
// =====================================

const friendAction = async (req, res) => {

    try {

        const { action, friendId, requestId } = req.body;

        // Remove Friend
        if (action === 'remove') {

            if (!mongoose.Types.ObjectId.isValid(friendId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid friend ID.'
                });
            }

            const isFriend = req.user.friends.some(
                id => id.toString() === friendId
            );

            if (!isFriend) {
                return res.status(404).json({
                    success: false,
                    message: 'Friend not found.'
                });
            }

            await Promise.all([
                User.updateOne(
                    { _id: req.user._id },
                    { $pull: { friends: friendId } }
                ),

                User.updateOne(
                    { _id: friendId },
                    { $pull: { friends: req.user._id } }
                )
            ]);

            return res.status(200).json({
                success: true,
                message: 'Friend removed successfully.'
            });
        }


        // Accept or Decline Request
        if (!['accept', 'decline'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action.'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request ID.'
            });
        }

        const request = await FriendRequest.findOne({
            _id: requestId,
            receiver: req.user._id,
            status: 'pending'
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Friend request not found.'
            });
        }

        // Decline
        if (action === 'decline') {

            await FriendRequest.deleteOne({
                _id: request._id
            });

            return res.status(200).json({
                success: true,
                message: 'Friend request declined.'
            });
        }

        // Accept
        await Promise.all([

            User.updateOne(
                { _id: req.user._id },
                { $addToSet: { friends: request.sender } }
            ),

            User.updateOne(
                { _id: request.sender },
                { $addToSet: { friends: req.user._id } }
            )

        ]);

        await FriendRequest.deleteOne({
            _id: request._id
        });

        res.status(200).json({
            success: true,
            message: 'Friend request accepted.'
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: 'Failed to perform friend action.',
            error: err.message
        });

    }
};


// =====================================
// GET: Friend Progress
// =====================================

const getFriendProgress = async (req, res) => {

    try {

        const { friendId } = req.query;

        if (!mongoose.Types.ObjectId.isValid(friendId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid friend ID.'
            });
        }

        const isFriend = req.user.friends.some(
            id => id.toString() === friendId
        );

        if (!isFriend) {
            return res.status(403).json({
                success: false,
                message: 'You can only view your friends progress.'
            });
        }

        const friend = await User.findById(friendId);

        if (!friend) {
            return res.status(404).json({
                success: false,
                message: 'Friend not found.'
            });
        }

        const { start, end } = getTodayRange();

        const meals = await Meal.find({
            user: friend._id,
            date: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0) - 6 * 24 * 60 * 60 * 1000),
                $lte: end
            }
        });

        const todayMeals = meals.filter(meal => {
            const date = new Date(meal.date);
            return date >= start && date <= end;
        });

        const consumed = calculateConsumed(todayMeals);
        const targets = calculateNutritionTargets(friend);
        const levelInfo = getLevelInfo(friend.xp);

        res.status(200).json({
            success: true,

            progress: {

                streak: calculateStreak(meals),

                level: levelInfo.level,

                calories: {
                    consumed: consumed.calories,
                    target: targets.calories
                },

                protein: {
                    consumed: consumed.protein,
                    target: targets.protein
                },

                carbs: {
                    consumed: consumed.carbs,
                    target: targets.carbs
                },

                fat: {
                    consumed: consumed.fat,
                    target: targets.fat
                }

            }
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: 'Failed to get friend progress.',
            error: err.message
        });

    }
};


module.exports = {
    getFriends,
    getFriendRequests,
    searchUsers,
    sendFriendRequest,
    friendAction,
    getFriendProgress
};
