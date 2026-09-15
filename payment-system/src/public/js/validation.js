// Lightweight client-side validation for UX only. The Zod schema on the
// server (src/validators/pay.schema.js) is the actual source of truth -
// this just gives instant feedback instead of a full page round-trip for
// an obviously empty/malformed field.
document.querySelectorAll("form").forEach(function (form) {
  form.addEventListener("submit", function (event) {
    let firstInvalid = null;

    form.querySelectorAll("input[required]").forEach(function (field) {
      field.classList.add("touched");
      clearFieldError(field);

      if (!field.checkValidity()) {
        if (!firstInvalid) firstInvalid = field;
        showFieldError(field, field.validationMessage);
      }
    });

    if (firstInvalid) {
      event.preventDefault();
      firstInvalid.focus();
    }
  });
});

function showFieldError(field, message) {
  const next = field.parentElement.nextElementSibling;
  if (next && next.classList && next.classList.contains("field-error")) return;
  const span = document.createElement("span");
  span.className = "field-error";
  span.textContent = message;
  field.closest("label").insertAdjacentElement("afterend", span);
}

function clearFieldError(field) {
  const next = field.closest("label").nextElementSibling;
  if (next && next.classList && next.classList.contains("field-error")) next.remove();
}
