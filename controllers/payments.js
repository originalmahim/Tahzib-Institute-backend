const mailSender = require('../utils/mailSender');
const { courseEnrollmentEmail } = require('../mail/templates/courseEnrollmentEmail');
require('dotenv').config();

const User = require('../models/user');
const Payment = require('../models/payment');
const Course = require('../models/course');
const CourseProgress = require("../models/courseProgress");
const axios = require('axios');
const { default: mongoose } = require('mongoose');

// ================ capture the payment and Initiate the ' order' ================
exports.capturePayment = async (req, res) => {
    const { coursesId } = req.body;
    const userId = req.body.id;
      console.log(req.body.id);

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

// =================== Verify Payment ===================
exports.verifyPayment = async (req, res) => {
    const { invoice_id } = req.body;

    if (!invoice_id) {
        return res.status(400).json({ success: false, message: "Missing invoice ID." });
    }

    try {
        const existingPayment = await Payment.findOne({ invoice_id });
        if (existingPayment && existingPayment.verified) {
            return res.status(200).json({
                success: true,
                message: "Payment already verified.",
                transaction_id: existingPayment.transaction_id,
                date: existingPayment.date,
                payment_method: existingPayment.payment_method,
                status: existingPayment.status,
            });
        }

        const options = {
            method: 'POST',
            url: 'https://sandbox.uddoktapay.com/api/verify-payment',
            headers: {
                'Accept': 'application/json',
                'RT-UDDOKTAPAY-API-KEY': process.env.UDDOKTAPAY_API_KEY,
                'Content-Type': 'application/json'
            },
            data: { invoice_id }
        };

        const response = await axios.request(options);

        if (response.data.status === 'COMPLETED') {
            const paymentData = {
                invoice_id,
                transaction_id: response.data.transaction_id,
                date: response.data.date,
                payment_method: response.data.payment_method,
                status: response.data.status,
                amount: response.data.metadata.amount,
                verified: true,
                userId: response.data.metadata.userId,
                courses: response.data.metadata.courseIds
            };

            const paymentRecord = await Payment.findOneAndUpdate(
                { invoice_id },
                paymentData,
                { upsert: true, new: true }
            );

            const enrollResult = await enrollStudents(response.data.metadata.courseIds, response.data.metadata.userId);

            return res.status(200).json({
                success: true,
                transaction_id: response.data.transaction_id,
                date: response.data.date,
                payment_method: response.data.payment_method,
                status: response.data.status,
                enrollResult,
                paymentRecord
            });
        } else {
            return res.status(400).json({ success: false, message: "Payment not completed." });
        }
    } catch (error) {
        console.error("Error verifying payment:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

// =================== Enroll Students After Payment ===================
const enrollStudents = async (courses, userId) => {
    const user = await User.findById(userId);
    if (!courses || !userId) {
        throw new Error("Please provide valid courses or user ID");
    }

    const results = [];

    for (const courseId of courses) {
        try {
            // Check if the user is already enrolled in this course
            if (user.courses.includes(courseId)) {
                results.push({ courseId, success: false, message: "User already enrolled in this course." });
                continue; // Skip to the next course
            }

            // Find the course and enroll the student
            const enrolledCourse = await Course.findOneAndUpdate(
                { _id: courseId },
                { $push: { studentsEnrolled: userId } },
                { new: true }
            );

            if (!enrolledCourse) {
                throw new Error("Course not found");
            }

            // Initialize course progress for the student
            const courseProgress = await CourseProgress.create({
                courseID: courseId,
                userId: userId,
                completedVideos: [],
            });

            // Update the student's enrolled courses and progress
            const enrolledStudent = await User.findByIdAndUpdate(
                userId,
                {
                    $push: {
                        courses: courseId,
                        courseProgress: courseProgress._id,
                    },
                },
                { new: true }
            );

            if (!enrolledStudent) {
                throw new Error("Student not found");
            }

            // Send an enrollment confirmation email to the student
            const emailResponse = await mailSender(
                enrolledStudent.email,
                `Successfully Enrolled in ${enrolledCourse.courseName}`,
                courseEnrollmentEmail(enrolledCourse.courseName, `${enrolledStudent.firstName}`)
            );

            console.log("Enrollment email sent successfully:", emailResponse);
            results.push({ courseId, success: true });
        } catch (error) {
            console.log("Error enrolling student:", error);
            results.push({ courseId, success: false, message: error.message });
        }
    }

    return results;
};

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