const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Shippo this way
const Shippo = require('shippo');
const shippo = Shippo(process.env.SHIPPO_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Define simplified package sizes for trading cards
const PACKAGE_SIZES = {
  SINGLE_CARD: {
        length: "6",
        width: "4",
        height: "0.1",
        weight: "0.1", // in lbs
        display_name: "Single Card",
        description: "For single cards in top loader",
        max_value: "100" // Maximum recommended value for this package size
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
app.get('/api/package-sizes', (req, res) => {
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
app.post('/api/get-shipping-rate', async (req, res) => {
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
                error: "No shipping options available. Please try different par$
            });
        }

        // Log available rates for debugging
        console.log('Available rates:', rates);

        // Sort by price
  rates = rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount$

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

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
