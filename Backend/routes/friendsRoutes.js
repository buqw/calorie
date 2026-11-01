
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const {
    getFriends,
    getFriendRequests,
    searchUsers,
    sendFriendRequest,
    friendAction,
    getFriendProgress
} = require('../controllers/friendsController');

router.use(authMiddleware);

router.get('/', getFriends);

router.get('/requests', getFriendRequests);

router.get('/search', searchUsers);

router.get('/progress', getFriendProgress);

router.post('/request', sendFriendRequest);

router.post('/action', friendAction);

module.exports = router;
