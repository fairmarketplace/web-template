// Get shipping rates for an item
export const getShippingRates = async ({ packageSize, sellerZip, buyerZip, declaredValue }) => {
  try {
    const response = await fetch('http://localhost:3000/api/get-shipping-rate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/
