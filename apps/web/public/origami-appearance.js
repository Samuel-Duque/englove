// La hoja de estilos aplica la preferencia del sistema si falta data-appearance.
(() => {
  const preferenceKey = "upward_english_appearance";
  const generationKey = "upward_english_appearance_epoch";
  try {
    const preference = sessionStorage.getItem(preferenceKey);
    if (preference !== "light" && preference !== "dark") return;

    const generation = sessionStorage.getItem(generationKey);
    if (generation !== null) {
      let current = null;
      let logoutPending = false;
      try {
        current = JSON.parse(
          localStorage.getItem("upward_english_session_epoch"),
        );
        logoutPending =
          localStorage.getItem("upward_english_logout_pending") === "1";
      } catch {
        // Si no se puede confirmar la generación, no se restaura la elección.
      }
      logoutPending ||= document.cookie
        .split(";")
        .some((cookie) => cookie.trim() === "upward_english_logout_pending=1");

      if (
        logoutPending ||
        current?.state !== "active" ||
        !Number.isInteger(current.gen) ||
        String(current.gen) !== generation
      ) {
        sessionStorage.removeItem(preferenceKey);
        sessionStorage.removeItem(generationKey);
        return;
      }
    }

    document.documentElement.dataset.appearance = preference;
  } catch {
    // El acceso al almacenamiento puede estar bloqueado.
  }
})();
