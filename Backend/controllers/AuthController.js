const crypt = require('bcrypt')
const crypto = require('crypto')
const User = require('../models/User')

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

module.exports = {
    register,
    login
}