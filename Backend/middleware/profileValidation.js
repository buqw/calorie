const validateProfile = (req,res,next) =>{
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

    //Check required fields
    if (
     birthDate === undefined || 
     gender === undefined || 
     height === undefined || 
     weight === undefined || 
     goal === undefined || 
     activityLevel === undefined || 
     dietType === undefined
    ){
        return res.status(400).json({ 
            message: 'Required profile fields are missing.' 
        });
    }

    // Validate birthDate 
    const date = new Date(birthDate);
    if(isNaN(date.getTime())){
        return res.status(400).json({
            message: 'Invalid birth date'
        })
    }

    if (date > new Date()) {
        return res.status(400).json({
            message: 'Birth date cannot be in the future'
        });
    }

    //Validate gender
    if(!['male','female'].includes(gender)){
        return res.status(400).json({
            message: 'Gender must be male or female'
        })
    }

    // Validate height
    if(
        typeof height !== 'object' ||
        height === null ||
        typeof height.value !== 'number' ||
        height.value <= 0 ||
        !['cm','in'].includes(height.unit)
    ){
        return res.status(400).json({
            message: 'Invalid height'
        })
    }

    // Validate weight
    if(
        typeof weight !== 'object' ||
        weight === null ||
        typeof weight.value !== 'number' ||
        weight.value <= 0 ||
        !['kg','lb'].includes(weight.unit)
    ){
        return res.status(400).json({
            message: 'Invalid weight'
        })
    }

    //Validate goal
    if(
        !['lose_weight', 'maintain_weight', 'gain_weight'].includes(goal)
    ){
        return res.status(400).json({
            message: 'Invalid goal'
        })
    }

    //Validate activity level
    if(
        ![  'sedentary',
            'light',
            'moderate',
            'active',
            'very_active'].includes(activityLevel)
    ){
        return res.status(400).json({
            message: 'Invalid activity level'
        })
    }

    //Validate diet type
    if(!['vegetarian', 'no_preference','vegan'].includes(dietType)){
        return res.status(400).json({
            message: 'Diet type must be vegetarian, vegan or no_preference'
        })
    }

    // Validate disliked food
    if (dislikedFoods !== undefined){ 
        if(
            !Array.isArray(dislikedFoods) ||
            !dislikedFoods.every(food => typeof food === 'string') 
        ){ 
            return res.status(400).json({ message: 'dislikedFoods must be an array of strings.' }); 
        } 
    }

    // Validate healthNotes only if provided 
    if (healthNotes !== undefined){ 
        if (typeof healthNotes !== 'string') { 
            return res.status(400).json(
                { 
                    message: 'healthNotes must be a string.' 
                }
            );
        } 
    }

    next();
}

module.exports = validateProfile;