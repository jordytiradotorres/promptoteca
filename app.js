const STORAGE_KEY = "promptoteca-prompts";
const BACKUP_STORAGE_KEY = "promptoteca-prompts-backup";
const EXPORT_VERSION = 1;

const form = document.querySelector("#prompt-form");
const titleInput = document.querySelector("#prompt-title");
const contentInput = document.querySelector("#prompt-content");
const modelInput = document.querySelector("#prompt-model");
const codeInput = document.querySelector("#prompt-is-code");
const promptList = document.querySelector("#prompt-list");
const promptCount = document.querySelector("#prompt-count");
const librarySubtitle = document.querySelector("#library-subtitle");
const formMessage = document.querySelector("#form-message");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const importFileInput = document.querySelector("#import-file");
const importMode = document.querySelector("#import-mode");
const conflictMode = document.querySelector("#conflict-mode");
const dataMessage = document.querySelector("#data-message");
const toastRegion = document.querySelector("#toast-region");

let prompts = loadPrompts();

function isValidIsoTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isValidMetadata(metadata) {
  return (
    metadata &&
    typeof metadata.model === "string" &&
    metadata.model.trim().length > 0 &&
    metadata.model.length <= 100 &&
    isValidIsoTimestamp(metadata.createdAt) &&
    isValidIsoTimestamp(metadata.updatedAt) &&
    new Date(metadata.updatedAt) >= new Date(metadata.createdAt) &&
    metadata.tokenEstimate &&
    Number.isFinite(metadata.tokenEstimate.min) &&
    Number.isFinite(metadata.tokenEstimate.max) &&
    ["high", "medium", "low"].includes(metadata.tokenEstimate.confidence)
  );
}

function estimateTokens(text, isCode = false) {
  if (typeof text !== "string") {
    throw new TypeError("El contenido debe ser una cadena de texto.");
  }
  if (typeof isCode !== "boolean") {
    throw new TypeError("El indicador isCode debe ser verdadero o falso.");
  }

  const trimmedText = text.trim();
  const wordCount = trimmedText ? trimmedText.split(/\s+/).length : 0;
  const multiplier = isCode ? 1.3 : 1;
  const min = Number((0.75 * wordCount * multiplier).toFixed(2));
  const max = Number((0.25 * text.length * multiplier).toFixed(2));
  // Use the upper bound for confidence so large prompts are classified conservatively.
  const confidence = max < 1000 ? "high" : max <= 5000 ? "medium" : "low";

  return { min, max, confidence };
}

function updateTimestamps(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("Los metadatos deben ser un objeto válido.");
  }
  if (!isValidIsoTimestamp(metadata.createdAt)) {
    throw new TypeError("createdAt debe ser una fecha ISO 8601 válida.");
  }
  if (!isValidIsoTimestamp(metadata.updatedAt)) {
    throw new TypeError("updatedAt debe ser una fecha ISO 8601 válida.");
  }

  const updatedMetadata = {
    ...metadata,
    updatedAt: new Date().toISOString(),
  };
  if (new Date(updatedMetadata.updatedAt) < new Date(metadata.createdAt)) {
    throw new RangeError("updatedAt no puede ser anterior a createdAt.");
  }

  return updatedMetadata;
}

function trackModel(modelName, content, isCode = false) {
  if (typeof modelName !== "string" || modelName.trim().length === 0) {
    throw new TypeError("El nombre del modelo no puede estar vacío.");
  }
  if (modelName.length > 100) {
    throw new RangeError(
      "El nombre del modelo no puede superar 100 caracteres.",
    );
  }
  if (typeof content !== "string") {
    throw new TypeError(
      "El contenido del prompt debe ser una cadena de texto.",
    );
  }

  const createdAt = new Date().toISOString();
  return updateTimestamps({
    model: modelName.trim(),
    createdAt,
    updatedAt: createdAt,
    tokenEstimate: estimateTokens(content, isCode),
  });
}

function showToast(message, state) {
  if (!message) return;

  const toast = document.createElement("p");
  toast.className = `toast-message is-${state}`;
  toast.setAttribute("role", state === "error" ? "alert" : "status");
  toast.textContent = message;
  toastRegion.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 5000);
}

function setFormMessage(message, state = "error") {
  formMessage.textContent = message;
  formMessage.classList.toggle("is-error", state === "error");
  formMessage.classList.toggle("is-success", state === "success");
  showToast(message, state);
}

function loadPrompts() {
  try {
    const storedPrompts = localStorage.getItem(STORAGE_KEY);
    if (!storedPrompts) return [];

    const parsedPrompts = JSON.parse(storedPrompts);
    if (!Array.isArray(parsedPrompts)) {
      throw new Error("El formato guardado no es válido.");
    }

    return parsedPrompts
      .filter(
        (prompt) =>
          prompt &&
          typeof prompt.id === "string" &&
          typeof prompt.title === "string" &&
          typeof prompt.content === "string",
      )
      .map((prompt) => {
        const { rating, notes, metadata, ...savedPrompt } = prompt;
        const validRating =
          Number.isInteger(rating) && rating >= 1 && rating <= 5;

        return {
          ...savedPrompt,
          ...(validRating ? { rating } : {}),
          ...(isValidMetadata(metadata) ? { metadata } : {}),
          notes: Array.isArray(notes)
            ? notes.filter(
                (note) =>
                  note &&
                  typeof note.id === "string" &&
                  typeof note.content === "string",
              )
            : [],
        };
      });
  } catch (error) {
    setFormMessage(
      "No se pudieron cargar los prompts guardados. Revisa el almacenamiento del navegador.",
    );
    console.error("Error al cargar los prompts:", error);
    return [];
  }
}

function savePrompts(nextPrompts, shouldRender = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPrompts));
    prompts = nextPrompts;
    setFormMessage("", "");
    if (shouldRender) renderPrompts();
    return true;
  } catch (error) {
    setFormMessage(
      "No se pudo guardar el cambio. Comprueba el espacio disponible en el navegador.",
    );
    console.error("Error al guardar los prompts:", error);
    return false;
  }
}

function isValidPrompt(prompt) {
  return (
    prompt &&
    typeof prompt === "object" &&
    !Array.isArray(prompt) &&
    typeof prompt.id === "string" &&
    prompt.id.trim().length > 0 &&
    typeof prompt.title === "string" &&
    prompt.title.trim().length > 0 &&
    typeof prompt.content === "string" &&
    prompt.content.trim().length > 0 &&
    (prompt.createdAt === undefined || isValidIsoTimestamp(prompt.createdAt)) &&
    (prompt.metadata === undefined || isValidMetadata(prompt.metadata)) &&
    (prompt.rating === undefined ||
      (Number.isInteger(prompt.rating) &&
        prompt.rating >= 1 &&
        prompt.rating <= 5)) &&
    (prompt.notes === undefined ||
      (Array.isArray(prompt.notes) &&
        prompt.notes.every(
          (note) =>
            note &&
            typeof note.id === "string" &&
            note.id.trim().length > 0 &&
            typeof note.content === "string" &&
            note.content.trim().length > 0,
        )))
  );
}

function calculateStats(promptCollection) {
  const ratedPrompts = promptCollection.filter((prompt) =>
    Number.isInteger(prompt.rating),
  );
  const averageRating = ratedPrompts.length
    ? Number(
        (
          ratedPrompts.reduce((total, prompt) => total + prompt.rating, 0) /
          ratedPrompts.length
        ).toFixed(2),
      )
    : null;
  const modelCounts = new Map();

  for (const prompt of promptCollection) {
    const model = prompt.metadata?.model?.trim();
    if (!model) continue;
    const key = model.toLowerCase();
    const current = modelCounts.get(key);
    if (current) current.count += 1;
    else modelCounts.set(key, { name: model, count: 1 });
  }

  let mostUsedModel = null;
  let highestCount = 0;
  for (const { name, count } of modelCounts.values()) {
    if (count > highestCount) {
      mostUsedModel = name;
      highestCount = count;
    }
  }

  return {
    totalPrompts: promptCollection.length,
    averageRating,
    mostUsedModel,
  };
}

function validatePromptCollection(promptCollection) {
  if (!Array.isArray(promptCollection)) {
    throw new Error("El campo «prompts» debe ser un array.");
  }

  const ids = new Set();
  for (const [index, prompt] of promptCollection.entries()) {
    if (!isValidPrompt(prompt)) {
      throw new Error(
        `El prompt ${index + 1} tiene datos incompletos o inválidos.`,
      );
    }
    if (ids.has(prompt.id)) {
      throw new Error(`El archivo contiene el ID duplicado «${prompt.id}».`);
    }
    ids.add(prompt.id);
  }

  return promptCollection.map((prompt) => ({
    ...prompt,
    notes: prompt.notes ?? [],
  }));
}

function validateExportFile(exportData) {
  if (
    !exportData ||
    typeof exportData !== "object" ||
    Array.isArray(exportData)
  ) {
    throw new Error("El archivo debe contener un objeto JSON.");
  }
  if (exportData.version !== EXPORT_VERSION) {
    throw new Error(
      `Versión no compatible: ${String(exportData.version)}. ` +
        `Esta aplicación admite la versión ${EXPORT_VERSION}.`,
    );
  }
  if (!isValidIsoTimestamp(exportData.exportedAt)) {
    throw new Error("La marca de tiempo de exportación no es válida.");
  }

  const importedPrompts = validatePromptCollection(exportData.prompts);
  const expectedStats = calculateStats(importedPrompts);
  const stats = exportData.stats;
  if (
    !stats ||
    typeof stats !== "object" ||
    Array.isArray(stats) ||
    stats.totalPrompts !== expectedStats.totalPrompts ||
    stats.averageRating !== expectedStats.averageRating ||
    stats.mostUsedModel !== expectedStats.mostUsedModel
  ) {
    throw new Error(
      "Las estadísticas del archivo no coinciden con los prompts incluidos.",
    );
  }

  return importedPrompts;
}

function setDataMessage(message, state = "success") {
  dataMessage.textContent = message;
  dataMessage.classList.toggle(
    "is-error",
    state === "error" && Boolean(message),
  );
  dataMessage.classList.toggle(
    "is-success",
    state === "success" && Boolean(message),
  );
  dataMessage.classList.toggle(
    "is-neutral",
    state === "neutral" && Boolean(message),
  );
  showToast(message, state);
}

function exportPrompts() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    const storedPrompts = validatePromptCollection(
      storedData ? JSON.parse(storedData) : [],
    );

    const exportedAt = new Date().toISOString();
    const exportData = {
      version: EXPORT_VERSION,
      exportedAt,
      stats: calculateStats(storedPrompts),
      prompts: storedPrompts,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileTimestamp = exportedAt.replace(/[:.]/g, "-");
    link.href = downloadUrl;
    link.download = `promptoteca-${fileTimestamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setDataMessage(
      `Exportación lista: ${storedPrompts.length} ${
        storedPrompts.length === 1 ? "prompt" : "prompts"
      }.`,
    );
  } catch (error) {
    setDataMessage(
      `No se pudo exportar la biblioteca: ${error.message}`,
      "error",
    );
    console.error("Error al exportar los prompts:", error);
  }
}

function saveImportedPrompts(nextPrompts) {
  const previousData = localStorage.getItem(STORAGE_KEY);
  const backup = JSON.stringify({
    savedAt: new Date().toISOString(),
    data: previousData,
  });

  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, backup);
  } catch (error) {
    throw new Error(
      `No se pudo crear la copia de seguridad; no se importó ningún dato. ${error.message}`,
    );
  }

  const serializedPrompts = JSON.stringify(nextPrompts);
  try {
    localStorage.setItem(STORAGE_KEY, serializedPrompts);
    if (localStorage.getItem(STORAGE_KEY) !== serializedPrompts) {
      throw new Error("La verificación de los datos guardados no coincidió.");
    }
  } catch (writeError) {
    try {
      if (previousData === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previousData);
    } catch (rollbackError) {
      throw new Error(
        `Falló la importación (${writeError.message}) y también la reversión ` +
          `(${rollbackError.message}). La copia de seguridad se conserva.`,
      );
    }
    throw new Error(
      `Falló la importación y se restauraron los datos anteriores. ${writeError.message}`,
    );
  }

  prompts = nextPrompts;
  setFormMessage("", "");
  renderPrompts();
}

async function importPromptFile(file) {
  const fileText = await file.text();
  let exportData;
  try {
    exportData = JSON.parse(fileText);
  } catch (error) {
    throw new Error(`El archivo no contiene JSON válido. ${error.message}`);
  }

  const importedPrompts = validateExportFile(exportData);
  const mode = importMode.value;
  const conflicts = importedPrompts.filter((prompt) =>
    prompts.some((current) => current.id === prompt.id),
  );
  let nextPrompts;

  if (mode === "replace") {
    if (
      !window.confirm(
        `Esto reemplazará tus ${prompts.length} prompts actuales por ` +
          `${importedPrompts.length} prompts importados. ` +
          "Se guardará una copia de seguridad antes de continuar. ¿Deseas seguir?",
      )
    ) {
      setDataMessage("Importación cancelada.", "neutral");
      return;
    }
    nextPrompts = importedPrompts;
  } else {
    const conflictChoice = conflictMode.value;
    const additions = importedPrompts.filter(
      (prompt) => !prompts.some((current) => current.id === prompt.id),
    );
    if (conflicts.length && conflictChoice === "overwrite") {
      if (
        !window.confirm(
          `Se reemplazarán ${conflicts.length} prompts con el mismo ID. ` +
            "Se guardará una copia de seguridad antes de continuar. ¿Deseas seguir?",
        )
      ) {
        setDataMessage("Importación cancelada.", "neutral");
        return;
      }
    }

    const importedById = new Map(
      importedPrompts.map((prompt) => [prompt.id, prompt]),
    );
    nextPrompts =
      conflictChoice === "overwrite"
        ? prompts.map((prompt) => importedById.get(prompt.id) ?? prompt)
        : [...prompts];
    nextPrompts.push(...additions);
  }

  if (
    mode === "merge" &&
    nextPrompts.length === prompts.length &&
    conflictMode.value === "keep"
  ) {
    setDataMessage(
      conflicts.length
        ? `No hubo cambios: se conservaron los ${conflicts.length} prompts en conflicto.`
        : "El archivo no contiene prompts nuevos; no hubo cambios.",
      "neutral",
    );
    return;
  }

  const previousCount = prompts.length;
  saveImportedPrompts(nextPrompts);
  const result =
    mode === "replace"
      ? `Biblioteca reemplazada por ${nextPrompts.length} ${
          nextPrompts.length === 1 ? "prompt" : "prompts"
        }.`
      : [
          `Se agregaron ${nextPrompts.length - previousCount} ${
            nextPrompts.length - previousCount === 1
              ? "prompt nuevo"
              : "prompts nuevos"
          }.`,
          conflicts.length
            ? conflictMode.value === "overwrite"
              ? `Se actualizaron ${conflicts.length} conflictos.`
              : `Se conservaron ${conflicts.length} conflictos.`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
  setDataMessage(
    `Importación completada. ${result} Copia de seguridad creada.`,
  );
}

function updateRatingControl(card, prompt, rating) {
  const ratingButtons = card.querySelectorAll(".rating-stars button");
  for (const button of ratingButtons) {
    const buttonRating = Number(button.dataset.rating);
    button.setAttribute("aria-checked", String(buttonRating === rating));
    button.tabIndex = buttonRating === (rating || 1) ? 0 : -1;
    button.setAttribute(
      "aria-label",
      `Calificar ${prompt.title} con ${buttonRating} ${
        buttonRating === 1 ? "estrella" : "estrellas"
      }`,
    );
  }
}

function ratePrompt(promptId, rating, card) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    setFormMessage("La calificación debe ser de 1 a 5 estrellas.");
    return false;
  }

  const prompt = prompts.find((item) => item.id === promptId);
  if (!prompt) {
    setFormMessage("No se encontró el prompt que quieres calificar.");
    return false;
  }

  const updatedPrompts = prompts.map((item) =>
    item.id === promptId ? { ...item, rating } : item,
  );
  if (!savePrompts(updatedPrompts, false)) return false;

  updateRatingControl(card, { ...prompt, rating }, rating);
  card.querySelector(".rating-status").textContent =
    `Calificación guardada: ${rating} de 5 estrellas.`;
  return true;
}

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function setNoteMessage(status, message, state = "success") {
  status.textContent = message;
  status.classList.toggle("is-error", state === "error");
  status.classList.toggle("is-success", state === "success");
  showToast(message, state);
}

function savePromptNotes(promptId, notes, message) {
  const updatedPrompts = prompts.map((prompt) =>
    prompt.id === promptId ? { ...prompt, notes } : prompt,
  );
  if (!savePrompts(updatedPrompts)) {
    const card = [...promptList.querySelectorAll(".prompt-card")].find(
      (item) => item.dataset.promptId === promptId,
    );
    if (card) {
      setNoteMessage(
        card.querySelector(".note-status"),
        formMessage.textContent,
        "error",
      );
    }
    return false;
  }

  const card = [...promptList.querySelectorAll(".prompt-card")].find(
    (item) => item.dataset.promptId === promptId,
  );
  if (card) setNoteMessage(card.querySelector(".note-status"), message);
  return true;
}

function createIcon(markup) {
  const wrapper = document.createElement("span");
  wrapper.innerHTML = markup;
  return wrapper.firstElementChild;
}

function renderPrompts() {
  promptList.replaceChildren();
  promptCount.textContent = String(prompts.length);
  librarySubtitle.textContent =
    prompts.length === 0
      ? "Tus prompts guardados aparecerán aquí."
      : `${prompts.length} ${prompts.length === 1 ? "prompt guardado" : "prompts guardados"}`;

  if (prompts.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.append(
      createIcon(
        '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3.75h7l5 5V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 4v5h5M9 14h6M9 17h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      ),
    );

    const title = document.createElement("strong");
    title.textContent = "Tu biblioteca está vacía";
    const description = document.createElement("p");
    description.textContent =
      "Guarda tu primer prompt y lo tendrás listo para tu próxima idea.";
    emptyState.append(icon, title, description);
    promptList.append(emptyState);
    return;
  }

  const sortedPrompts = [...prompts].sort((a, b) => {
    const aCreatedAt = a.metadata?.createdAt ?? a.createdAt ?? "";
    const bCreatedAt = b.metadata?.createdAt ?? b.createdAt ?? "";
    return new Date(bCreatedAt).getTime() - new Date(aCreatedAt).getTime();
  });

  for (const prompt of sortedPrompts) {
    const card = document.createElement("article");
    card.className = "prompt-card";
    card.dataset.promptId = prompt.id;

    const topLine = document.createElement("div");
    topLine.className = "card-topline";
    const textGroup = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = prompt.title;
    textGroup.append(title);

    if (prompt.createdAt) {
      const date = new Date(prompt.createdAt);
      if (!Number.isNaN(date.getTime())) {
        const time = document.createElement("time");
        time.dateTime = date.toISOString();
        time.textContent = new Intl.DateTimeFormat("es", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(date);
        textGroup.append(time);
      }
    }

    if (prompt.metadata) {
      const metadataSection = document.createElement("section");
      metadataSection.className = "metadata-section";
      metadataSection.setAttribute(
        "aria-label",
        `Metadatos de ${prompt.title}`,
      );

      const modelName = document.createElement("p");
      modelName.className = "metadata-model";
      modelName.textContent = `Modelo: ${prompt.metadata.model}`;

      const timestamps = document.createElement("div");
      timestamps.className = "metadata-timestamps";
      for (const [label, value] of [
        ["Creado", prompt.metadata.createdAt],
        ["Actualizado", prompt.metadata.updatedAt],
      ]) {
        const timestamp = document.createElement("time");
        timestamp.dateTime = value;
        timestamp.textContent = `${label}: ${new Intl.DateTimeFormat("es", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))}`;
        timestamps.append(timestamp);
      }

      const tokenEstimate = document.createElement("p");
      tokenEstimate.className = `token-estimate confidence-${prompt.metadata.tokenEstimate.confidence}`;
      const confidenceLabel = {
        high: "alta",
        medium: "media",
        low: "baja",
      }[prompt.metadata.tokenEstimate.confidence];
      tokenEstimate.textContent =
        `Tokens estimados: ${prompt.metadata.tokenEstimate.min}–` +
        `${prompt.metadata.tokenEstimate.max} · Confianza ${confidenceLabel}`;

      metadataSection.append(modelName, timestamps, tokenEstimate);
      textGroup.append(metadataSection);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Eliminar ${prompt.title}`);
    deleteButton.title = "Eliminar prompt";
    deleteButton.append(
      createIcon(
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      ),
    );
    deleteButton.addEventListener("click", () => {
      savePrompts(prompts.filter((item) => item.id !== prompt.id));
    });

    topLine.append(textGroup, deleteButton);
    const content = document.createElement("p");
    content.className = "prompt-card-content";
    content.textContent = prompt.content;

    const ratingSection = document.createElement("div");
    ratingSection.className = "rating-section";
    const ratingLabel = document.createElement("span");
    ratingLabel.className = "rating-label";
    ratingLabel.textContent = "¿Qué tan eficaz fue este prompt?";

    const ratingGroup = document.createElement("div");
    ratingGroup.className = "rating-stars";
    ratingGroup.setAttribute("role", "radiogroup");
    ratingGroup.setAttribute(
      "aria-label",
      `Calificación de eficacia para ${prompt.title}`,
    );
    ratingGroup.setAttribute("aria-describedby", "rating-help");

    for (let rating = 1; rating <= 5; rating += 1) {
      const starButton = document.createElement("button");
      starButton.type = "button";
      starButton.setAttribute("role", "radio");
      starButton.setAttribute("aria-checked", String(prompt.rating === rating));
      starButton.setAttribute(
        "aria-label",
        `Calificar ${prompt.title} con ${rating} ${
          rating === 1 ? "estrella" : "estrellas"
        }`,
      );
      starButton.dataset.rating = String(rating);
      starButton.tabIndex = rating === (prompt.rating || 1) ? 0 : -1;
      starButton.textContent = "★";
      starButton.addEventListener("click", () => {
        ratePrompt(prompt.id, rating, card);
      });
      starButton.addEventListener("keydown", (event) => {
        let nextRating = rating;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          nextRating = Math.min(5, rating + 1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          nextRating = Math.max(1, rating - 1);
        } else if (event.key === "Home") {
          nextRating = 1;
        } else if (event.key === "End") {
          nextRating = 5;
        } else {
          return;
        }

        event.preventDefault();
        const nextButton = ratingGroup.querySelector(
          `[data-rating="${nextRating}"]`,
        );
        if (ratePrompt(prompt.id, nextRating, card)) nextButton.focus();
      });
      ratingGroup.append(starButton);
    }

    const ratingStatus = document.createElement("span");
    ratingStatus.className = "rating-status";
    ratingStatus.setAttribute("role", "status");
    ratingStatus.setAttribute("aria-live", "polite");
    ratingStatus.textContent = prompt.rating
      ? `Tu calificación: ${prompt.rating} de 5 estrellas.`
      : "Aún no has calificado este prompt.";
    ratingSection.append(ratingLabel, ratingGroup, ratingStatus);

    const notesSection = document.createElement("section");
    notesSection.className = "notes-section";
    const notesHeading = document.createElement("h4");
    notesHeading.className = "notes-heading";
    notesHeading.textContent = "Notas";
    notesSection.append(notesHeading);

    const notesList = document.createElement("ul");
    notesList.className = "notes-list";
    notesList.setAttribute("aria-label", `Notas de ${prompt.title}`);

    for (const note of prompt.notes) {
      const noteItem = document.createElement("li");
      noteItem.className = "note-item";
      const noteContent = document.createElement("p");
      noteContent.className = "note-content";
      noteContent.textContent = note.content;

      const noteActions = document.createElement("div");
      noteActions.className = "note-actions";
      const editButton = document.createElement("button");
      editButton.className = "note-action-button";
      editButton.type = "button";
      editButton.textContent = "Editar";
      editButton.setAttribute("aria-label", `Editar nota de ${prompt.title}`);
      editButton.addEventListener("click", () => {
        const editor = document.createElement("textarea");
        editor.className = "note-input";
        editor.rows = 3;
        editor.maxLength = 1000;
        editor.value = note.content;
        editor.setAttribute("aria-label", `Editar nota de ${prompt.title}`);

        const saveButton = document.createElement("button");
        saveButton.className = "note-save-button";
        saveButton.type = "button";
        saveButton.textContent = "Guardar cambios";
        saveButton.addEventListener("click", () => {
          const updatedContent = editor.value.trim();
          if (!updatedContent) {
            setNoteMessage(
              card.querySelector(".note-status"),
              "La nota no puede estar vacía.",
              "error",
            );
            editor.focus();
            return;
          }

          const updatedNotes = prompt.notes.map((item) =>
            item.id === note.id ? { ...item, content: updatedContent } : item,
          );
          savePromptNotes(prompt.id, updatedNotes, "Nota actualizada.");
        });

        const cancelButton = document.createElement("button");
        cancelButton.className = "note-action-button";
        cancelButton.type = "button";
        cancelButton.textContent = "Cancelar";
        cancelButton.addEventListener("click", () => renderPrompts());

        noteItem.replaceChildren(editor, document.createElement("div"));
        noteItem.lastElementChild.className = "note-actions";
        noteItem.lastElementChild.append(saveButton, cancelButton);
        editor.focus();
      });

      const deleteNoteButton = document.createElement("button");
      deleteNoteButton.className = "note-action-button note-delete-button";
      deleteNoteButton.type = "button";
      deleteNoteButton.textContent = "Eliminar";
      deleteNoteButton.setAttribute(
        "aria-label",
        `Eliminar nota de ${prompt.title}`,
      );
      deleteNoteButton.addEventListener("click", () => {
        savePromptNotes(
          prompt.id,
          prompt.notes.filter((item) => item.id !== note.id),
          "Nota eliminada.",
        );
      });

      noteActions.append(editButton, deleteNoteButton);
      noteItem.append(noteContent, noteActions);
      notesList.append(noteItem);
    }

    const addNoteForm = document.createElement("form");
    addNoteForm.className = "note-form";
    const noteInput = document.createElement("textarea");
    noteInput.className = "note-input";
    noteInput.rows = 2;
    noteInput.maxLength = 1000;
    noteInput.placeholder = "Escribe una nota para este prompt...";
    noteInput.setAttribute("aria-label", `Nueva nota para ${prompt.title}`);
    noteInput.required = true;

    const addNoteButton = document.createElement("button");
    addNoteButton.className = "note-save-button";
    addNoteButton.type = "submit";
    addNoteButton.textContent = "Añadir nota";
    addNoteForm.append(noteInput, addNoteButton);
    addNoteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const noteContent = noteInput.value.trim();
      if (!noteContent) {
        setNoteMessage(
          card.querySelector(".note-status"),
          "Escribe una nota antes de guardarla.",
          "error",
        );
        noteInput.focus();
        return;
      }

      savePromptNotes(
        prompt.id,
        [...prompt.notes, { id: createId(), content: noteContent }],
        "Nota guardada.",
      );
    });

    const noteStatus = document.createElement("p");
    noteStatus.className = "note-status";
    noteStatus.setAttribute("role", "status");
    noteStatus.setAttribute("aria-live", "polite");
    notesSection.append(notesList, addNoteForm, noteStatus);

    card.append(topLine, content, ratingSection, notesSection);
    promptList.append(card);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const modelName = modelInput.value.trim();

  if (!title || !content || !modelName) {
    setFormMessage("Escribe el título, el contenido y el nombre del modelo.");
    return;
  }

  let prompt;
  try {
    prompt = {
      id: createId(),
      title,
      content,
      createdAt: new Date().toISOString(),
      metadata: trackModel(modelName, content, codeInput.checked),
      notes: [],
    };
  } catch (error) {
    setFormMessage(error.message);
    console.error("Error al crear los metadatos del prompt:", error);
    return;
  }

  if (savePrompts([...prompts, prompt])) {
    form.reset();
    titleInput.focus();
    setFormMessage("Prompt creado correctamente.", "success");
  }
});

exportButton.addEventListener("click", exportPrompts);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", async () => {
  const [file] = importFileInput.files;
  if (!file) return;

  setDataMessage("");
  try {
    await importPromptFile(file);
  } catch (error) {
    setDataMessage(`No se pudo importar el archivo: ${error.message}`, "error");
    console.error("Error al importar los prompts:", error);
  } finally {
    importFileInput.value = "";
  }
});

window.trackModel = trackModel;
window.updateTimestamps = updateTimestamps;
window.estimateTokens = estimateTokens;

renderPrompts();
