const express = require('express')
const app = express();
require('dotenv').config();
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')

app.use(express.json())
app.use(cookieParser())

//Auth Routes
const authRoutes = require('./routes/AuthRoutes')
app.use('/api/auth', authRoutes)
//Profile Routes
const profileRoutes = require('./routes/profileRoutes')
app.use('/api/profile',profileRoutes);
//Meals routes
const mealRoutes = require('./routes/mealRoutes')
app.use('/api/meals', mealRoutes)
//Dashboard routes
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes)
// History routes
const historyRoutes = require('./routes/historyRoutes');
app.use('/api/history', historyRoutes);

// MongoDB Connection
mongoose.connect(process.env.Mongo_URI)
    .then(()=>{
        console.log("connected.")
    })
    .catch((e)=>{
        console.log(e)
    })

app.listen(3000,()=>{
    console.log("Listening on port 3000")
})