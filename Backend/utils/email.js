const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendResetCode = async (email, code) => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Calorie - Password Reset Code',
        text: `Your Calorie password reset code is: ${code}. This code expires in 10 minutes.`
    });
};

module.exports = {
    sendResetCode
};