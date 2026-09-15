// Purely cosmetic - the server enforces expiry regardless (see
// checkoutService.expireIfNeeded, checked again on submit). This just
// stops a customer staring at a stale "5 minutes" claim.
(function () {
  const note = document.querySelector(".expiry-note");
  const countdown = document.getElementById("countdown");
  if (!note || !countdown) return;

  const expiresAt = new Date(note.dataset.expiresAt).getTime();

  function tick() {
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      countdown.textContent = "any moment";
      location.reload(); // let the server render the "expired" page
      return;
    }
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    countdown.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  tick();
  setInterval(tick, 1000);
})();
