const express = require('express');
const router = express.Router();

const { capturePayment, verifyPayment } = require('../controllers/payments');
const { auth, isStudent } = require('../middleware/auth');

router.post('/capturePayment',  capturePayment);
router.post('/verifyPayment', verifyPayment);

module.exports = router
