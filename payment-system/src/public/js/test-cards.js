// Sandbox-only convenience: fills the card form from a test-card button's
// data attributes rather than requiring manual copy-paste. Never touches
// real card data - these numbers only exist in the Bank System's own
// sandbox seed.
document.querySelectorAll(".test-card-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const form = document.getElementById("pay-form");
    if (!form) return;
    form.card_number.value = btn.dataset.cardNumber;
    form.card_holder_name.value = btn.dataset.cardHolderName;
    form.expiry_month.value = btn.dataset.expiryMonth;
    form.expiry_year.value = btn.dataset.expiryYear;
    form.cvv.value = btn.dataset.cvv;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
