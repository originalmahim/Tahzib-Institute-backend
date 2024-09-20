const User = require('../models/user');
const mailSender = require('../utils/mailSender');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// ================ resetPasswordToken ================
exports.resetPasswordToken = async (req, res) => {
    try {
        // extract email 
        const { email } = req.body;

        // email validation
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Your Email is not registered with us'
            });
        }

        // generate token
        const token = crypto.randomBytes(20).toString("hex");

        // update user by adding token & token expire date
        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            { token: token, resetPasswordTokenExpires: Date.now() + 5 * 60 * 1000 },
            { new: true }); // by marking true, it will return updated user


        // create url
        const url = `http://localhost:5173/update-password/${token}`;

        // send email containing URL
await mailSender(
    email, 
    'Password Reset Link', 
    `<!DOCTYPE html>
    <html lang="en">
  
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
            body {
                background-color: #f9f9f9;
                font-family: Arial, sans-serif;
                font-size: 16px;
                color: #333;
                margin: 0;
                padding: 0;
            }
  
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #ffffff;
                border: 1px solid #dddddd;
                text-align: center;
            }
  
            .logo {
                max-width: 150px;
                margin-bottom: 20px;
            }
  
            .message {
                font-size: 20px;
                font-weight: bold;
                color: #555555;
                margin-bottom: 20px;
            }
  
            .body {
                font-size: 16px;
                line-height: 1.6;
                color: #666666;
                margin-bottom: 20px;
            }
  
            .cta {
                display: inline-block;
                padding: 10px 20px;
                background-color: #ffd60a;
                color: #000000;
                text-decoration: none;
                border-radius: 5px;
                font-size: 16px;
                font-weight: bold;
                margin-top: 20px;
            }
  
            .support {
                font-size: 14px;
                color: #999999;
                margin-top: 20px;
            }
  
            .footer {
                font-size: 12px;
                color: #999999;
                margin-top: 30px;
                text-align: center;
            }
        </style>
    </head>
  
    <body>
        <div class="container">
            <img class="logo" src="https://tahzibinstitute.com/wp-content/uploads/2024/09/tahzib-institute-1.png" alt="Tahzib Institute Logo">
            <div class="message">Password Reset Request</div>
            <div class="body">
                <p>Assalamualaikum,</p>
                <p>We received a request to reset the password for your account at <strong>Tahzib Institute</strong>.</p>
                <p>If you did not make this request, please ignore this email. Otherwise, you can reset your password by clicking the button below:</p>
                <a href="${url}" class="cta">Reset Your Password</a>
                <p>This link will expire in 2 minutes. If you need further assistance, feel free to reach out to our support team.</p>
            </div>
            <div class="support">For any questions, contact us at <a href="mailto:tahzibinstitute@gmail.com">tahzibinstitute@gmail.com</a>.</div>
            <div class="footer">&copy; 2024 Tahzib Institute. All Rights Reserved.</div>
        </div>
    </body>
  
    </html>`
  );
  

        // return succes response
        res.status(200).json({
            success: true,
            message: 'Email sent successfully , Please check your mail box and change password'
        })
    }

    catch (error) {
        console.log('Error while creating token for reset password');
        console.log(error)
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while creating token for reset password'
        })
    }
}



// ================ resetPassword ================
exports.resetPassword = async (req, res) => {
    try {
        // extract data
        // extract token by anyone from this 3 ways
        const token = req.body?.token || req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');

        const { password, confirmPassword } = req.body;

        // validation
        if (!token || !password || !confirmPassword) {
            return res.status(401).json({
                success: false,
                message: "All fiels are required...!"
            });
        }

        // validate both passwords
        if (password !== confirmPassword) {
            return res.status(401).json({
                success: false,
                message: 'Passowrds are not matched'
            });
        }


        // find user by token from DB
        const userDetails = await User.findOne({ token: token });

        // check ==> is this needed or not ==> for security  
        if (token !== userDetails.token) {
            return res.status(401).json({
                success: false,
                message: 'Password Reset token is not matched'
            });
        }

        // console.log('userDetails.resetPasswordExpires = ', userDetails.resetPasswordExpires);

        // check token is expire or not
        if (!(userDetails.resetPasswordTokenExpires > Date.now())) {
            return res.status(401).json({
                success: false,
                message: 'Token is expired, please regenerate token'
            });
        }


        // hash new passoword
        const hashedPassword = await bcrypt.hash(password, 10);

        // update user with New Password
        await User.findOneAndUpdate(
            { token },
            { password: hashedPassword },
            { new: true });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    }

    catch (error) {
        console.log('Error while reseting password');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while reseting password12'
        });
    }
}