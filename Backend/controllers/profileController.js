const getProfile = async (req,res)=>{
    try{
        const user = req.user;
        res.status(200).json({
            user: {
                id: user._id,
                email: user.email,
                birthDate: user.birthDate,
                gender: user.gender,
                height: user.height,
                weight: user.weight,
                goal: user.goal,
                activityLevel: user.activityLevel,
                dietType: user.dietType,
                dislikedFoods: user.dislikedFoods,
                healthNotes: user.healthNotes
            }            
        })        
    }catch(e){
        res.status(500).json({
            message: 'Server error',
            error: e.message
        })
    }
}

const updateProfile = async (req,res)=>{
    try{
        const user = req.user

        const {
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

        user.birthDate = birthDate;
        user.gender = gender;
        user.height = height;
        user.weight = weight;
        user.goal = goal;
        user.activityLevel = activityLevel;
        user.dietType = dietType;
        user.dislikedFoods = dislikedFoods ?? [];
        user.healthNotes = healthNotes ?? "";
        await user.save();

        res.status(200).json({
            message: 'Profile updated successfully.',
            user: {
                id: user._id,
                email: user.email,
                birthDate: user.birthDate,
                gender: user.gender,
                height: user.height,
                weight: user.weight,
                goal: user.goal,
                activityLevel: user.activityLevel,
                dietType: user.dietType,
                dislikedFoods: user.dislikedFoods,
                healthNotes: user.healthNotes                                
            }
        })
    }catch(e){
        res.status(500).json({
            message: 'Server error',
            error: e.message
        })
    }
}

module.exports ={
    getProfile,
    updateProfile

} 