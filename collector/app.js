const STORAGE_KEY = "collector_state_v1";

const defaultTasks = [
  { id: "T-1001", type: "picking", status: "pending", title: "Picking Pedido 1001" },
  { id: "T-1002", type: "packing", status: "pending", title: "Packing Pedido 1002" },
  { id: "T-1003", type: "expedicao", status: "pending", title: "Expedicao Rota 48" },
];

const state = loadState();

const screens = document.querySelectorAll(".screen");
const taskList = document.getElementById("taskList");
const queueCount = document.getElementById("queueCount");
const netStatus = document.getElementById("netStatus");
const syncBtn = document.getElementById("syncBtn");
const seedBtn = document.getElementById("seedBtn");

const pickAddress = document.getElementById("pickAddress");
const pickSku = document.getElementById("pickSku");
const pickQty = document.getElementById("pickQty");
const pickMissing = document.getElementById("pickMissing");
const pickMissingQty = document.getElementById("pickMissingQty");

const packOrder = document.getElementById("packOrder");
const packSku = document.getElementById("packSku");
const packQty = document.getElementById("packQty");

const shipVolume = document.getElementById("shipVolume");

const scanOverlay = document.getElementById("scanOverlay");
const scanVideo = document.getElementById("scanVideo");
const scanHint = document.getElementById("scanHint");
const closeScan = document.getElementById("closeScan");

let scanTargetId = null;
let scanStream = null;
let scanDetector = null;
let scanActive = false;

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { tasks: defaultTasks, queue: [], currentTaskId: null, lastSync: null };
  }
  try {
    const parsed = JSON.parse(stored);
    return {
      tasks: parsed.tasks?.length ? parsed.tasks : defaultTasks,
      queue: parsed.queue || [],
      currentTaskId: parsed.currentTaskId || null,
      lastSync: parsed.lastSync || null,
    };
  } catch (error) {
    return { tasks: defaultTasks, queue: [], currentTaskId: null, lastSync: null };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setOnlineStatus() {
  if (navigator.onLine) {
    netStatus.textContent = "Online";
    netStatus.style.background = "#16a34a";
  } else {
    netStatus.textContent = "Offline";
    netStatus.style.background = "#dc2626";
  }
}

function updateQueueUI() {
  queueCount.textContent = state.queue.length.toString();
}

function showScreen(name) {
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });
}

function getCurrentTask() {
  return state.tasks.find((task) => task.id === state.currentTaskId) || null;
}

function setCurrentTask(id) {
  state.currentTaskId = id;
  saveState();
}

function addQueue(type, payload) {
  state.queue.push({
    id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    payload,
    ts: new Date().toISOString(),
  });
  saveState();
  updateQueueUI();
}

function renderTasks() {
  taskList.innerHTML = "";
  state.tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = "task-card";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = `${task.type.toUpperCase()} | ${task.status.toUpperCase()}`;

    const action = document.createElement("button");
    action.className = "btn btn-primary";
    action.textContent = "Iniciar";
    action.disabled = task.status === "done";
    action.addEventListener("click", () => {
      setCurrentTask(task.id);
      showScreen(task.type);
    });

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(action);
    taskList.appendChild(card);
  });
}

function resetPickForm() {
  pickAddress.value = "";
  pickSku.value = "";
  pickQty.value = "1";
  pickMissing.checked = false;
  pickMissingQty.value = "0";
}

function resetPackForm() {
  packOrder.value = "";
  packSku.value = "";
  packQty.value = "1";
}

function resetShipForm() {
  shipVolume.value = "";
}

function markTaskDone() {
  const task = getCurrentTask();
  if (!task) return;
  task.status = "done";
  addQueue(`${task.type}-done`, { taskId: task.id });
  saveState();
  renderTasks();
  showScreen("tasks");
}

async function syncQueue() {
  if (!navigator.onLine) {
    alert("Sem conexao. Sincronizacao sera feita quando voltar online.");
    return;
  }
  if (!state.queue.length) {
    alert("Fila vazia.");
    return;
  }
  state.queue = [];
  state.lastSync = new Date().toISOString();
  saveState();
  updateQueueUI();
  alert("Fila sincronizada.");
}

function handleScanInput(event) {
  if (event.key !== "Enter") return;
  const next = event.target.dataset.next;
  if (next) {
    const nextField = document.getElementById(next);
    if (nextField) nextField.focus();
  }
}

async function openScanner(targetId) {
  scanTargetId = targetId;
  scanOverlay.classList.remove("hidden");
  scanHint.textContent = "Aponte a camera para o codigo de barras.";

  if (!("mediaDevices" in navigator)) {
    scanHint.textContent = "Camera nao disponivel.";
    return;
  }

  if ("BarcodeDetector" in window) {
    scanDetector = new BarcodeDetector({
      formats: [
        "code_128",
        "code_39",
        "code_93",
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "itf",
        "qr_code",
      ],
    });
  } else {
    scanHint.textContent = "BarcodeDetector indisponivel. Use o scanner BT.";
    return;
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    scanVideo.srcObject = scanStream;
    scanActive = true;
    requestAnimationFrame(scanLoop);
  } catch (error) {
    scanHint.textContent = "Falha ao abrir camera.";
  }
}

async function scanLoop() {
  if (!scanActive || !scanDetector) return;
  try {
    const barcodes = await scanDetector.detect(scanVideo);
    if (barcodes.length) {
      const value = barcodes[0].rawValue || "";
      const input = document.getElementById(scanTargetId);
      if (input) input.value = value;
      closeScanner();
      return;
    }
  } catch (error) {
    scanHint.textContent = "Erro na leitura. Tente novamente.";
  }
  requestAnimationFrame(scanLoop);
}

function closeScanner() {
  scanActive = false;
  scanOverlay.classList.add("hidden");
  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
  }
  scanVideo.srcObject = null;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Silent for MVP
    });
  }
}

function bindEvents() {
  document.querySelectorAll("[data-action='back']").forEach((btn) => {
    btn.addEventListener("click", () => showScreen("tasks"));
  });

  document.querySelectorAll("[data-qty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = parseInt(btn.dataset.qty, 10);
      const next = Math.max(0, parseInt(pickQty.value, 10) + delta);
      pickQty.value = next.toString();
    });
  });

  document.querySelectorAll("[data-scan]").forEach((btn) => {
    btn.addEventListener("click", () => openScanner(btn.dataset.scan));
  });

  closeScan.addEventListener("click", closeScanner);

  pickAddress.addEventListener("keydown", handleScanInput);
  pickSku.addEventListener("keydown", handleScanInput);
  packOrder.addEventListener("keydown", handleScanInput);
  packSku.addEventListener("keydown", handleScanInput);
  shipVolume.addEventListener("keydown", handleScanInput);

  document.getElementById("pickConfirm").addEventListener("click", () => {
    if (!pickAddress.value || !pickSku.value) {
      alert("Bipe endereco e SKU.");
      return;
    }
    addQueue("picking-item", {
      taskId: state.currentTaskId,
      address: pickAddress.value,
      sku: pickSku.value,
      qty: Number(pickQty.value || 0),
      missing: pickMissing.checked,
      missingQty: Number(pickMissingQty.value || 0),
    });
    pickSku.value = "";
    pickQty.value = "1";
    pickMissing.checked = false;
    pickMissingQty.value = "0";
  });

  document.getElementById("pickDone").addEventListener("click", () => {
    markTaskDone();
    resetPickForm();
  });

  document.getElementById("packConfirm").addEventListener("click", () => {
    if (!packOrder.value || !packSku.value) {
      alert("Bipe pedido/caixa e SKU.");
      return;
    }
    addQueue("packing-item", {
      taskId: state.currentTaskId,
      order: packOrder.value,
      sku: packSku.value,
      qty: Number(packQty.value || 0),
    });
    packSku.value = "";
    packQty.value = "1";
  });

  document.getElementById("packDone").addEventListener("click", () => {
    markTaskDone();
    resetPackForm();
  });

  document.getElementById("shipConfirm").addEventListener("click", () => {
    if (!shipVolume.value) {
      alert("Bipe volume/pallet.");
      return;
    }
    addQueue("expedicao-volume", {
      taskId: state.currentTaskId,
      volume: shipVolume.value,
    });
    shipVolume.value = "";
  });

  document.getElementById("shipDone").addEventListener("click", () => {
    markTaskDone();
    resetShipForm();
  });

  syncBtn.addEventListener("click", syncQueue);

  seedBtn.addEventListener("click", () => {
    state.tasks = defaultTasks.map((task) => ({ ...task }));
    state.queue = [];
    state.currentTaskId = null;
    saveState();
    renderTasks();
    updateQueueUI();
  });

  window.addEventListener("online", setOnlineStatus);
  window.addEventListener("offline", setOnlineStatus);
}

function init() {
  renderTasks();
  updateQueueUI();
  setOnlineStatus();
  bindEvents();
  registerServiceWorker();
}

init();
