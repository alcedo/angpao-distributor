export function bindWalletEvents(elements, handlers) {
  elements.form.addEventListener("submit", handlers.onGenerateSubmit);
  elements.clearBtn.addEventListener("click", handlers.onClear);
  elements.toggleKeysBtn.addEventListener("click", handlers.onToggleKeys);
  elements.downloadCsvBtn.addEventListener("click", handlers.onDownloadCsv);
  elements.downloadJsonBtn.addEventListener("click", handlers.onDownloadJson);
  elements.tableBody.addEventListener("click", handlers.onCopyValueClick);
}

export function bindNetworkWalletEvents(optionalElements, handlers) {
  if (optionalElements.clusterSelect) {
    optionalElements.clusterSelect.addEventListener("change", handlers.onClusterChange);
  }

  if (optionalElements.phantomConnectBtn) {
    optionalElements.phantomConnectBtn.addEventListener(
      "click",
      handlers.onPhantomConnectToggle,
    );
  }
}
