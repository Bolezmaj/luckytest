const fetch = require('node-fetch');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { orderID, userEmail, hwid } = req.body;

    if (!orderID || !userEmail || !hwid) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }

    try {
        // Use PayPal REST API to verify the payment
        const paypalResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.PAYPAL_ACCESS_TOKEN}`, // PayPal Access Token from environment variables
            }
        });

        const paypalData = await paypalResponse.json();

        console.log("PayPal Response:", paypalData);  // Debugging: Log the response

        // Check if payment was successful
        if (paypalData.status === 'COMPLETED') {
            // Generate the license key using KeyAuth API
            const keyAuthResponse = await fetch(`https://keyauth.win/api/seller/?sellerkey=${process.env.KEYAUTH_SELLER_KEY}&type=add&expiry=1&mask=******-******-******-******-******-******&level=1&amount=1&format=text`, {
                method: 'GET',
            });

            const keyAuthData = await keyAuthResponse.text(); // License key expected in plain text

            // Setup Nodemailer to send email with the license key
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.EMAIL_PASSWORD,
                }
            });

            const mailOptions = {
                from: process.env.EMAIL,
                to: userEmail,
                subject: 'Your Product License Key',
                text: `Thank you for your purchase! Here is your license key: ${keyAuthData}`,
            };

            // Send email
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                    return res.status(500).json({ message: 'Error sending email' });
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });

            // Respond with a token (license key)
            const token = `license-token-for-${hwid}`;
            return res.status(200).json({ token });
        } else {
            return res.status(400).json({ message: 'Payment not completed successfully', paypalData });
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        return res.status(500).json({ message: 'Error processing payment', error: error.message });
    }
};
