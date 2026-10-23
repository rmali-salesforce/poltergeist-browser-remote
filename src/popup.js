document.addEventListener("DOMContentLoaded", async () => {
  const statusDisplay = document.getElementById("statusDisplay");
  const profileDisplay = document.getElementById("profileDisplay");
  const profileInput = document.getElementById("profileInput");
  const saveBtn = document.getElementById("saveBtn");
  const feedback = document.getElementById("feedback");

  // Query background script state
  try {
    const response = await browser.runtime.sendMessage({ type: "GET_STATUS" });
    if (response) {
      statusDisplay.textContent = response.status;
      profileDisplay.textContent = response.profile;
    }
  } catch (err) {
    statusDisplay.textContent = "Offline";
  }

  // Pre-fill input with the existing profile from storage
  const data = await browser.storage.local.get("profileName");
  if (data.profileName) {
    profileInput.value = data.profileName;
    profileDisplay.textContent = data.profileName;
  }

  // Save handler
  saveBtn.addEventListener("click", async () => {
    const value = profileInput.value.trim().toLowerCase();
    if (!value) return;

    await browser.storage.local.set({ profileName: value });
    profileDisplay.textContent = value;
    feedback.textContent = `Saved as "${value}"`;

    setTimeout(() => {
      feedback.textContent = "";
    }, 2000);
  });
});