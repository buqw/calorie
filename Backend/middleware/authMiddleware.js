const User = require("../models/User")

const authMiddleware = async (req,resizeBy,next)=>{
    try{
        const token = req.cookies.token;
        if(!token){
            return res.status(401).json({
                message: 'Authentication required.'
            })
        }

        const user = await User.findOne({token})
        if(!user){
            return res.status(401).json({
                message: 'Invalid or expired token'
            })
        }
        req.user = user
        next()
    }catch(e){
        res.status(500).json({
            message: 'Server error',
            error: e.message
        })

    }
}
module.exports = authMiddleware;
