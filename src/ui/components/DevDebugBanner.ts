// ============================================================================
// DEV DEBUG BANNER - Reusable debug banner component
// Renders a passed string in the top-left corner of the screen
// ============================================================================

let bannerElement: HTMLElement | null = null;

/**
 * Renders or updates the debug banner with the provided message
 * @param message - The debug message to display
 */
export function renderDevDebugBanner(message: string): void {
  // Remove existing banner if it exists
  if (bannerElement) {
    bannerElement.remove();
    bannerElement = null;
  }

  // Don't render if message is empty
  if (!message || message.trim() === "") {
    return;
  }

  // Create banner element
  bannerElement = document.createElement("div");
  bannerElement.className = "dev-debug-banner";
  bannerElement.textContent = message;
  
  // Append to body
  document.body.appendChild(bannerElement);
}

/**
 * Removes the debug banner from the DOM
 */
export function removeDevDebugBanner(): void {
  if (bannerElement) {
    bannerElement.remove();
    bannerElement = null;
  }
}

/**
 * Updates the message of an existing banner, or creates one if it doesn't exist
 * @param message - The debug message to display
 */
export function updateDevDebugBanner(message: string): void {
  if (bannerElement) {
    bannerElement.textContent = message;
  } else {
    renderDevDebugBanner(message);
  }
}


