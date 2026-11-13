const mongoose = require('mongoose');
const crypt = require('bcrypt')
const crypto = require('crypto')
const User = require('../models/User')
const Meal = require('../models/Meal');
const FriendRequest = require('../models/FriendRequest');
const { sendResetCode } = require('../utils/email');


const register = async (req,res)=>{
    
    try{
        const {
            username,
            email,
            password,
            birthDate,
            gender,
            height,
            weight,
            goal,
            activityLevel,
            dietType,
            dislikedFoods,
            healthNotes            
        } = req.body;

        const existingEmail = await User.findOne({email})
        if(existingEmail){
            return res.status(400).json({
                message: 'Email already exists.'
            })
        }
        
        const existingUsername = await User.findOne({username})
        if(existingUsername){
            return res.status(400).json({
                message: 'Username already exisits'
            })
        }

        
        // Hashing password
        const hashedPassword = await crypt.hash(password,10)
        
        //Generate token
        const token = crypto.randomBytes(32).toString("hex");

        // Creating user
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            token,
            birthDate,
            gender,
            height:{
                value: height.value,
                unit: height.unit
            },
            weight:{
                value: weight.value,
                unit: weight.unit
            },
            goal,
            activityLevel,
            dietType,
            dislikedFoods,
            healthNotes            
        })

        res.cookie('token', token, {
            httpOnly: true
        })

        res.status(201).json({
            message: 'User created successfully.',
            userId: user._id 
        })

    }catch(e){
        res.status(500).json({
            message: 'Server error.',
            error: e.message
        })
    }

}

const login = async (req,res) =>{
    try{
        const {email, password} = req.body;
        //Find user
        const user = await User.findOne({email});
        if(!user){
            return res.status(400).json({
                message: 'Invalid email or password.'
            })
        }

        //Compare password
        const passwordMatch = await crypt.compare(password, user.password);
        if(!passwordMatch){
            return res.status(400).json({
                message:'Invalid email or password.'
            })
        }

        // Token generation
        const token = crypto.randomBytes(32).toString("hex")
        user.token = token;
        await user.save();

        res.cookie('token', token, {
            httpOnly: true
        })

        //Sending success response
        res.status(200).json({
            message: 'Login successful.',
            userId: user._id,
        })
    }catch(e){
        res.status(500).json({
            message: 'Server error',
            error: e.message  
        })
    }
}

const logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
    });
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required.'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters.'
            });
        }

        // Get authenticated user
        const user = req.user;

        // Verify current password
        const passwordMatch = await crypt.compare(
            currentPassword,
            user.password
        );

        if (!passwordMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        // Prevent using the same password
        const samePassword = await crypt.compare(
            newPassword,
            user.password
        );

        if (samePassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password.'
            });
        }

        // Hash new password
        user.password = await crypt.hash(newPassword, 10);

        // Generate a new token
        const token = crypto.randomBytes(32).toString('hex');
        user.token = token;

        await user.save();

        // Update authentication cookie
        res.cookie('token', token, {
            httpOnly: true
        });

        return res.status(200).json({
            success: true,
            message: 'Password changed successfully.'
        });

    } catch (error) {
        console.error('Change password error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to change password.'
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required.'
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Generate 6-digit code
        const code = crypto.randomInt(100000, 1000000).toString();

        // Hash the code before storing it
        const hashedCode = crypto
            .createHash('sha256')
            .update(code)
            .digest('hex');

        user.resetPasswordCode = hashedCode;

        // Code expires after 10 minutes
        user.resetPasswordCodeExpires = new Date(
            Date.now() + 10 * 60 * 1000
        );

        await user.save();

        await sendResetCode(user.email, code);

        res.status(200).json({
            success: true,
            message: 'Password reset code sent successfully.'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to send password reset code.',
            error: err.message
        });
    }
};

const verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: 'Email and code are required.'
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid code.'
            });
        }

        // Check code expiry
        if (
            !user.resetPasswordCode ||
            !user.resetPasswordCodeExpires ||
            user.resetPasswordCodeExpires < new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: 'Code is invalid or expired.'
            });
        }

        // Hash the code entered by the user
        const hashedCode = crypto
            .createHash('sha256')
            .update(code)
            .digest('hex');

        // Compare codes
        if (hashedCode !== user.resetPasswordCode) {
            return res.status(400).json({
                success: false,
                message: 'Invalid code.'
            });
        }

        // Generate temporary reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        user.resetToken = resetToken;

        // Reset token expires after 10 minutes
        user.resetTokenExpires = new Date(
            Date.now() + 10 * 60 * 1000
        );

        // Remove used code
        user.resetPasswordCode = null;
        user.resetPasswordCodeExpires = null;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Code verified successfully.',
            resetToken
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to verify reset code.',
            error: err.message
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Reset token and new password are required.'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters.'
            });
        }

        const user = await User.findOne({
            resetToken,
            resetTokenExpires: {
                $gt: new Date()
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token.'
            });
        }

        //Hash new password
        const hashedPassword = await crypt.hash(newPassword, 10);

        user.password = hashedPassword;

        // Invalidate reset token
        user.resetToken = null;
        user.resetTokenExpires = null;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully.'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to reset password.',
            error: err.message
        });
    }
};

const deleteAccount = async (req, res) => {
    let session;

    try {
        const { confirmation } = req.body;

        if (confirmation !== 'DELETE') {
            return res.status(400).json({
                success: false,
                message: 'Please type DELETE to confirm account deletion.'
            });
        }

        const userId = req.user._id;

        session = await mongoose.startSession();

        await session.withTransaction(async () => {

            // Delete user's meals
            await Meal.deleteMany(
                { user: userId },
                { session }
            );

            // Delete sent and received friend requests
            await FriendRequest.deleteMany(
                {
                    $or: [
                        { sender: userId },
                        { receiver: userId }
                    ]
                },
                { session }
            );

            // Remove user from other users' friends lists
            await User.updateMany(
                { friends: userId },
                { $pull: { friends: userId } },
                { session }
            );

            // Delete user account
            await User.deleteOne(
                { _id: userId },
                { session }
            );
        });

        res.clearCookie('token', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
        });

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully.'
        });

    } catch (error) {
        console.error('Delete account error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete account.'
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};
module.exports = {
    register,
    login,
    logout,
    changePassword,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    deleteAccount
}