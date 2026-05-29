const CONFIRM_EVENT = "spendly-confirm";

export function confirmSpendly(options) {
  const payload = typeof options === "string" ? { message: options } : options;
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(CONFIRM_EVENT, {
      detail: {
        title: "Confirm action",
        message: "",
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
        tone: "default",
        ...payload,
        resolve
      }
    }));
  });
}

export { CONFIRM_EVENT };
