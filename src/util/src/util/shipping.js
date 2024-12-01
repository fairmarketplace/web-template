export const PACKAGE_SIZES = {
  SINGLE_CARD: 'Single Card',
  SEALED_PRODUCT: 'Sealed Product (Hobby Box/ETB)',
  BULK: 'Bulk Order'
};

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

export const createShippingLabel = async ({ rateId, sellerEmail, declaredValue }) => {
  try {
    const response = await fetch('http://localhost:3000/api/create-label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rate_id: rateId,
        seller_email: sellerEmail,
        declared_value: declaredValue
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    return data;
  } catch (error) {
    console.error('Label creation error:', error);
    throw error;
  }
};
