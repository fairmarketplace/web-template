/**
 * This file contains server side endpoints that can be used to perform backend
 * tasks that can not be handled in the browser.
 *
 * The endpoints should not clash with the application routes. Therefore, the
 * endpoints are prefixed in the main server where this file is used.
 */

const express = require('express');
const bodyParser = require('body-parser');
const { deserialize } = require('./api-util/sdk');
const Shippo = require('shippo');
const shippo = Shippo(process.env.SHIPPO_API_KEY);

const initiateLoginAs = require('./api/initiate-login-as');
const loginAs = require('./api/login-as');
const transactionLineItems = require('./api/transaction-line-items');
const initiatePrivileged = require('./api/initiate-privileged');
const transitionPrivileged = require('./api/transition-privileged');

const createUserWithIdp = require('./api/auth/createUserWithIdp');

const { authenticateFacebook, authenticateFacebookCallback } = require('./api/auth/facebook');
const { authenticateGoogle, authenticateGoogleCallback } = require('./api/auth/google');

const router = express.Router();

// ================ API router middleware: ================ //

// Parse Transit body first to a string
router.use(
  bodyParser.text({
    type: 'application/transit+json',
  })
);

// Deserialize Transit body string to JS data
router.use((req, res, next) => {
  if (req.get('Content-Type') === 'application/transit+json' && typeof req.body === 'string') {
    try {
      req.body = deserialize(req.body);
    } catch (e) {
      console.error('Failed to parse request body as Transit:');
      console.error(e);
      res.status(400).send('Invalid Transit in request body.');
      return;
    }
  }
  next();
});

// ================ API router endpoints: ================ //

router.get('/initiate-login-as', initiateLoginAs);
router.get('/login-as', loginAs);
router.post('/transaction-line-items', transactionLineItems);
router.post('/initiate-privileged', initiatePrivileged);
router.post('/transition-privileged', transitionPrivileged);

// Create user with identity provider (e.g. Facebook or Google)
// This endpoint is called to create a new user after user has confirmed
// they want to continue with the data fetched from IdP (e.g. name and email)
router.post('/auth/create-user-with-idp', createUserWithIdp);

// Facebook authentication endpoints

// This endpoint is called when user wants to initiate authenticaiton with Facebook
router.get('/auth/facebook', authenticateFacebook);

// This is the route for callback URL the user is redirected after authenticating
// with Facebook. In this route a Passport.js custom callback is used for calling
// loginWithIdp endpoint in Sharetribe Auth API to authenticate user to the marketplace
router.get('/auth/facebook/callback', authenticateFacebookCallback);

// Google authentication endpoints

// This endpoint is called when user wants to initiate authenticaiton with Google
router.get('/auth/google', authenticateGoogle);

// This is the route for callback URL the user is redirected after authenticating
// with Google. In this route a Passport.js custom callback is used for calling
// loginWithIdp endpoint in Sharetribe Auth API to authenticate user to the marketplace
router.get('/auth/google/callback', authenticateGoogleCallback);

// ================ Shipping endpoints: ================ //

// Define package sizes
const PACKAGE_SIZES = {
    SINGLE_CARD: {
        length: "6",
        width: "4",
        height: "0.1",
        weight: "0.1",
        display_name: "Single Card",
        description: "For single cards in top loader",
        max_value: "100"
    },
    SEALED_PRODUCT: {
        length: "12",
        width: "8",
        height: "6",
        weight: "2",
        display_name: "Sealed Product",
        description: "For Hobby Boxes, Elite Trainer Boxes, or similar items",
        max_value: "500"
    },
    BULK: {
        length: "14",
        width: "12",
        height: "8",
        weight: "10",
        display_name: "Bulk Order",
        description: "For large orders, bulk cards (500+ cards)",
        max_value: "1000"
    }
};

// Calculate insurance requirement
const getRequiredInsuranceAmount = (declaredValue) => {
    const value = parseFloat(declaredValue);
    if (value >= 25) {
        return value;
    }
    return 0;
};

// Get available package sizes
router.get('/api/package-sizes', (req, res) => {
    res.json({
        success: true,
        sizes: Object.entries(PACKAGE_SIZES).map(([key, value]) => ({
            id: key,
            name: value.display_name,
            description: value.description,
            max_value: value.max_value
        }))
    });
});

// Calculate shipping rates
router.post('/api/get-shipping-rate', async (req, res) => {
    try {
        const {
            package_size,
            seller_zip,
            buyer_zip,
            declared_value
        } = req.body;

        // Validate required fields
        if (!declared_value || !seller_zip || !buyer_zip || !package_size) {
            return res.status(400).json({
                success: false,
                error: "Missing required shipping information"
            });
        }

        const packageDetails = PACKAGE_SIZES[package_size.toUpperCase()];
        if (!packageDetails) {
            return res.status(400).json({
                success: false,
                error: "Invalid package size"
            });
        }

        // Calculate required insurance
        const requiredInsurance = getRequiredInsuranceAmount(declared_value);

        const shipmentOptions = {
            address_from: {
                zip: seller_zip,
                country: "US"
            },
            address_to: {
                zip: buyer_zip,
                country: "US"
            },
            parcels: [{
                length: packageDetails.length,
                width: packageDetails.width,
                height: packageDetails.height,
                distance_unit: "in",
                weight: packageDetails.weight,
                mass_unit: "lb"
            }],
            async: false
        };

        // Add insurance if required (value >= $25)
        if (requiredInsurance > 0) {
            shipmentOptions.extra = {
                insurance: {
                    amount: requiredInsurance,
                    currency: "USD"
                }
            };
        }

        const shipment = await shippo.shipment.create(shipmentOptions);

        // Filter for rates with tracking
        let rates = shipment.rates;

        if (!rates || rates.length === 0) {
            return res.status(400).json({
                success: false,
                error: "No shipping options available. Please try different parameters."
            });
        }

        // Sort by price
        rates = rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));

        res.json({
            success: true,
            insurance_required: requiredInsurance > 0,
            insurance_amount: requiredInsurance,
            rates: rates.map(rate => ({
                rate_id: rate.object_id,
                amount: rate.amount,
                provider: rate.provider,
                service: rate.servicelevel.name,
                delivery_days: rate.estimated_days,
                insurance_included: requiredInsurance > 0
            }))
        });

    } catch (error) {
        console.error('Shipping rate error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create shipping label
router.post('/api/create-label', async (req, res) => {
    try {
        const {
            rate_id,
            seller_email,
            declared_value
        } = req.body;

        if (!rate_id || !seller_email || !declared_value) {
            return res.status(400).json({
                success: false,
                error: "Missing required information"
            });
        }

        const transaction = await shippo.transaction.create({
            rate: rate_id,
            label_file_type: "PDF",
            async: false
        });

        if (transaction.status === "SUCCESS") {
            res.json({
                success: true,
                label_url: transaction.label_url,
                tracking_number: transaction.tracking_number,
                tracking_url: transaction.tracking_url_provider
            });
        } else {
            res.status(400).json({
                success: false,
                error: "Failed to create label",
                details: transaction.messages
            });
        }

    } catch (error) {
        console.error('Label creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
