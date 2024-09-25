const mailSender = require('../utils/mailSender');
const { courseEnrollmentEmail } = require('../mail/templates/courseEnrollmentEmail');
require('dotenv').config();

const User = require('../models/user');
const Course = require('../models/course');
const CourseProgress = require("../models/courseProgress");
const axios = require('axios');
const { default: mongoose } = require('mongoose');

// ================ capture the payment and Initiate the 'WalletMaxPay order' ================
exports.capturePayment = async (req, res) => {
    const { coursesId } = req.body;
     const userId = req.body.id;
    //  console.log(req.body);

    if (coursesId.length === 0) {
        return res.json({ success: false, message: "Please provide Course Id" });
    }

    let totalAmount = 0;

    for (const course_id of coursesId) {
        let course;
        try {
            course = await Course.findById(course_id);
            if (!course) {
                return res.status(404).json({ success: false, message: "Could not find the course" });
            }
            const uid = new mongoose.Types.ObjectId(userId);
            if (course.studentsEnrolled.includes(uid)) {
                return res.status(400).json({ success: false, message: "Student is already Enrolled" });
            }

            totalAmount += course.price;
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Prepare payment request to Uddoktapay
    const paymentData = {
            courseIds: coursesId,
             userId: req.body.id,
    };

    const options = {
        method: 'POST',
        url: 'https://sandbox.uddoktapay.com/api/checkout-v2',
        headers: {
            'Accept': 'application/json',
            'RT-UDDOKTAPAY-API-KEY': process.env.UDDOKTAPAY_API_KEY,
            'Content-Type': 'application/json'
        },
        data: {
          full_name: req.body.full_name,
           email: req.body.email,
           amount: totalAmount,
           userId: userId,
            metadata: paymentData,
            redirect_url: 'http://localhost:3000/Payment/Successfull',
            cancel_url: 'http://localhost:3000/Payment/Cancelled',
            return_type: 'GET'
        }
    };

    try {
        const paymentResponse = await axios.request(options);
        
        return res.json({
            success: true,
            payment_url: paymentResponse.data.payment_url,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Could not initiate Uddoktapay Order" });
    }
}

// ================ verify the payment ================

exports.verifyPayment = async (req, res) => {
    const { invoice_id } = req.body; // Ensure this is correctly extracted
    // console.log(req.body);

    if (!invoice_id) {
        return res.status(400).json({ success: false, message: "Missing invoice ID." });
    }

    const options = {
        method: 'POST',
        url: 'https://sandbox.uddoktapay.com/api/verify-payment',
        headers: {
            'Accept': 'application/json',
            'RT-UDDOKTAPAY-API-KEY': process.env.UDDOKTAPAY_API_KEY, // Ensure the API key is set in the environment
            'Content-Type': 'application/json'
        },
        data: { invoice_id }
    };

    try {
        const response = await axios.request(options);

        if (response.data.status === 'COMPLETED') {
            // await enrollStudents(response.data.metadata.courseIds, response.data.metadata.userId, res); // enroll students
            //  console.log(response.data.metadata.userId);
            // await sendPaymentSuccessEmail( response.data.email ,response.data.metadata.userId, response.data.transaction_id, response.data.amount); 
            return res.status(200).json({
                success: true,
                transaction_id: response.data.transaction_id,
                date: response.data.date,
                payment_method: response.data.payment_method,
                status: response.data.status
            });
        } else {
            return res.status(400).json({ success: false, message: "Payment not completed." });
        }
    } catch (error) {
        // console.error("Error verifying payment:", error.message); // Log the error message
        return res.status(500).json({ success: false, message: "Server error." });
    }
};


// ================ enroll Students to course after payment ================
// const enrollStudents = async (courses, userId, res) => {
//     if (!courses || !userId) {
//         return res.status(400).json({ success: false, message: "Please Provide data for Courses or UserId" });
//     }

//     for (const courseId of courses) {
//         try {
//             const enrolledCourse = await Course.findOneAndUpdate(
//                 { _id: courseId },
//                 { $push: { studentsEnrolled: userId } },
//                 { new: true }
//             );

//             if (!enrolledCourse) {
//                 return res.status(500).json({ success: false, message: "Course not Found" });
//             }

//             const courseProgress = await CourseProgress.create({
//                 courseID: courseId,
//                 userId: userId,
//                 completedVideos: [],
//             });

//             const enrolledStudent = await User.findByIdAndUpdate(
//                 userId,
//                 {
//                     $push: {
//                         courses: courseId,
//                         courseProgress: courseProgress._id,
//                     },
//                 },
//                 { new: true }
//             );

//             // Check if enrolledStudent exists before sending email
//             if (enrolledStudent) {
//                 await mailSender(
//                     enrolledStudent.email,
//                     `Successfully Enrolled into ${enrolledCourse.courseName}`,
//                     courseEnrollmentEmail(enrolledCourse.courseName, `${enrolledStudent.firstName}`)
//                 );
//                 console.log("Email Sent Successfully");
//             } else {
//                 console.error("User not found for email sending");
//             }

//         } catch (error) {
//             console.log("Error enrolling student:", error);
//             return res.status(500).json({ success: false, message: error.message });
//         }
//     }
// };

// ================ send Payment Success Email ================
// const sendPaymentSuccessEmail = async ( email, userId, orderId, amount) => {
//     if (!userId || !orderId || !amount) {
//         throw new Error("Please provide all the fields");
//     }

//     try {
//         // Find student
//         // const enrolledStudent = await User.findById(userId);
//         // if (!enrolledStudent) {
//         //     throw new Error("User not found");
//         // }

//         await mailSender(
//             email,
//             `Payment Received`,
//             courseEnrollmentEmail(`Tareqaziz`, amount / 100, orderId)
//         );
//         console.log("Payment success email sent");
//     } catch (error) {
//         console.log("Error in sending mail:", error);
//         throw new Error("Could not send email");
//     }
// };