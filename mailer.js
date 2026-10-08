const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendCustomerBookingEmail(booking) {
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: booking.customerEmail,
      subject: "Lucky Movers - Booking Received",
      html: `
        <h2>Lucky Movers</h2>

        <p>Hello ${booking.customerName || "Customer"},</p>

        <p>Thank you for booking with Lucky Movers.</p>

        <p>We have received your truck booking request.</p>

        <h3>Booking Details</h3>

        <p><strong>Booking Code:</strong> ${booking.bookingCode || "Pending"}</p>
        <p><strong>Truck:</strong> ${booking.selectedTruck || "Not specified"}</p>
        <p><strong>Pickup:</strong> ${booking.pickupLocation || "Not specified"}</p>
        <p><strong>Destination:</strong> ${booking.destination || "Not specified"}</p>
        <p><strong>Price:</strong> UGX ${booking.offeredPrice || 0}</p>

        <p>
          Our team is processing your request.
          We will notify you when a driver accepts your booking.
        </p>

        <p>Thank you for choosing Lucky Movers.</p>

        <p><strong>Reliable Truck Hiring Made Simple</strong></p>
      `
    });

    if (result.error) {
      console.error("Customer email failed:", result.error);
      throw new Error(result.error.message);
    }

    console.log("Customer booking email sent:", result.data);
    return result.data;

  } catch (error) {
    console.error("Customer email failed:", error);
    throw error;
  }
}

module.exports = {
  sendCustomerBookingEmail
};