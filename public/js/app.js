(() => {
  const sidebar = document.getElementById("sidebar");
  const scrim = document.querySelector(".sidebar-scrim");
  const menuButton = document.querySelector("[data-sidebar-toggle]");
  const closeButton = document.querySelector("[data-sidebar-close]");

  const closeSidebar = () => {
    sidebar?.classList.remove("open");
    scrim?.classList.remove("visible");
    document.body.style.overflow = "";
  };

  const openSidebar = () => {
    sidebar?.classList.add("open");
    scrim?.classList.add("visible");
    document.body.style.overflow = "hidden";
  };

  menuButton?.addEventListener("click", openSidebar);
  closeButton?.addEventListener("click", closeSidebar);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  // Flash messages can be dismissed or fade out after a while.
  document.querySelectorAll("[data-dismiss]").forEach((button) => {
    button.addEventListener("click", () => {
      const alert = button.closest(".alert");
      if (alert) alert.remove();
    });
  });

  window.setTimeout(() => {
    document.querySelectorAll(".alert-success[data-auto-dismiss]").forEach((alert) => {
      alert.style.transition = "opacity .4s ease, transform .4s ease";
      alert.style.opacity = "0";
      alert.style.transform = "translateY(-4px)";
      window.setTimeout(() => alert.remove(), 450);
    });
  }, 6000);

  // Destructive actions ask for confirmation before submitting.
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const message = form.getAttribute("data-confirm") || "Continue with this action?";
      if (!window.confirm(message)) event.preventDefault();
    });
  });

  // Live stock calculation for stock-in / stock-out / adjustment.
  const form = document.querySelector('form[action^="/stock/"]');
  const select = document.querySelector("[data-stock-select]");
  const quantityInput = document.querySelector("[data-quantity-input]");
  const newQuantityInput = document.querySelector("#newQuantity");

  if (form && select) {
    const mode = window.location.pathname.endsWith("/in")
      ? "in"
      : window.location.pathname.endsWith("/out")
        ? "out"
        : "adjustment";

    const valueEl = document.querySelector("[data-balance-value]");
    const unitEl = document.querySelector("[data-balance-unit]");
    const noteEl = document.querySelector("[data-balance-note]");
    const afterEl = document.querySelector("[data-balance-after]");
    const hintEl = document.querySelector("[data-quantity-hint]");
    const quantityField = quantityInput || newQuantityInput;

    const numberFormat = new Intl.NumberFormat("en-PH");

    const selectedOption = () => {
      if (!select.value) return null;
      return select.options[select.selectedIndex] || null;
    };

    const updatePreview = () => {
      const option = selectedOption();
      if (!option) {
        if (valueEl) valueEl.textContent = "—";
        if (unitEl) unitEl.textContent = "Select a product";
        if (noteEl) noteEl.textContent = "Choose a product to see its reorder point.";
        if (afterEl) afterEl.textContent = "—";
        if (quantityInput) quantityInput.removeAttribute("max");
        return;
      }

      const stock = Number(option.dataset.stock || 0);
      const unit = option.dataset.unit || "unit";
      const reorder = Number(option.dataset.reorder || 0);
      const rawAmount = quantityField ? Number(quantityField.value) : NaN;

      if (valueEl) valueEl.textContent = numberFormat.format(stock);
      if (unitEl) unitEl.textContent = `${unit}${stock === 1 ? "" : "s"} on hand`;

      if (noteEl) {
        if (stock <= 0) {
          noteEl.textContent = `Out of stock · reorder at ${reorder}`;
          noteEl.style.color = "var(--danger)";
        } else if (stock <= reorder) {
          noteEl.textContent = `Low stock · reorder at ${reorder}`;
          noteEl.style.color = "var(--warning)";
        } else {
          noteEl.textContent = `Above reorder level of ${reorder}`;
          noteEl.style.color = "";
        }
      }

      if (quantityInput && mode === "out") {
        quantityInput.max = String(stock);
        if (hintEl) hintEl.textContent = `Available: ${numberFormat.format(stock)} ${unit}(s).`;
      }

      let after = null;
      if (mode === "in" && Number.isFinite(rawAmount)) after = stock + rawAmount;
      if (mode === "out" && Number.isFinite(rawAmount)) after = stock - rawAmount;
      if (mode === "adjustment" && Number.isFinite(rawAmount)) after = rawAmount;

      if (afterEl) {
        afterEl.textContent = Number.isFinite(after) ? numberFormat.format(after) : "—";
        afterEl.style.color =
          Number.isFinite(after) && after < 0 ? "var(--danger)" : "";
      }
    };

    select.addEventListener("change", () => {
      updatePreview();
      if (quantityField) quantityField.focus();
    });

    quantityField?.addEventListener("input", updatePreview);
    updatePreview();
  }
})();
