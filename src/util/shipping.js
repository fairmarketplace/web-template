// Get shipping rates for an item
export const getShippingRates = async ({ packageSize, sellerZip, buyerZip, declaredValue }) => {
  try {
    const response = await fetch('http://localhost:3000/api/get-shipping-rate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package_size: packageSize,
        seller_zip: sellerZip,
        buyer_zip: buyerZip,
        declared_value: declaredValue
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    return data;
  } catch (error) {
    console.error('Shipping rate error:', error);
    throw error;
  }
};

// Define package sizes for trading cards
export const PACKAGE_SIZES = {
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
