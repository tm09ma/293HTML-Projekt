const form = document.querySelector(".contact-form");

if (form) {
  const statusElement = form.querySelector(".form-status");
  const submitButton = form.querySelector(".form-submit");
  const messageField = form.elements.message;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const setStatus = (message, state = "") => {
    statusElement.textContent = message;
    statusElement.className = `form-status${state ? ` is-${state}` : ""}`;
  };

  const validate = ({ name, email, message }) => {
    if (!name || !email || !message) {
      return "Bitte fülle alle Felder aus.";
    }

    if (!emailPattern.test(email)) {
      return "Bitte gib eine gültige E-Mail-Adresse ein.";
    }

    return "";
  };

  messageField.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      message: formData.get("message").trim(),
    };
    const validationError = validate(payload);

    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    submitButton.disabled = true;
    setStatus("Nachricht wird gesendet...");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Die Nachricht konnte nicht gesendet werden.");
      }

      form.reset();
      setStatus("Danke, deine Nachricht wurde erfolgreich gesendet.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  });
}
