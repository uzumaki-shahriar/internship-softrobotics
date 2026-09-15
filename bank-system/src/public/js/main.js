// Confirm dialogs for destructive/state-changing admin actions.
document.addEventListener("submit", function (event) {
  const form = event.target.closest(".confirm-form");
  if (!form) return;
  const message = form.dataset.confirm || "Are you sure?";
  if (!window.confirm(message)) {
    event.preventDefault();
  }
});
