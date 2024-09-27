const mongoose = require('mongoose');

// =================== Payment Schema ===================
const paymentSchema = new mongoose.Schema({
    invoice_id: { type: String, required: true, unique: true }, 
    transaction_id: String,  
    date: String, 
    payment_method: String,  
    status: String,  
    amount: Number, 
    verified: { type: Boolean, default: false },  
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },  
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }]  
});

module.exports = mongoose.model('Payment', paymentSchema);