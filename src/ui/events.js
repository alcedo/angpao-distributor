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

export function bindRecipientEvents(optionalElements, handlers) {
  if (optionalElements.importRecipientsBtn) {
    optionalElements.importRecipientsBtn.addEventListener("click", handlers.onImportRecipients);
  }

  if (optionalElements.clearRecipientsBtn) {
    optionalElements.clearRecipientsBtn.addEventListener("click", handlers.onClearRecipients);
  }
}

export function bindTokenEvents(optionalElements, handlers) {
  if (optionalElements.tokenMintSelect) {
    optionalElements.tokenMintSelect.addEventListener("change", handlers.onTokenSelectionChange);
  }

  if (optionalElements.tokenOptionList) {
    optionalElements.tokenOptionList.addEventListener("click", handlers.onTokenOptionPick);
  }
}

export function bindMintEvents(optionalElements, handlers) {
  if (optionalElements.mintCreateBtn) {
    optionalElements.mintCreateBtn.addEventListener("click", handlers.onMintCreate);
  }
}

export function bindDistributionEvents(optionalElements, handlers) {
  if (optionalElements.distributionTotalAmountInput) {
    optionalElements.distributionTotalAmountInput.addEventListener(
      "input",
      handlers.onDistributionAmountInput,
    );
  }

  if (optionalElements.distributionMainnetAckFees) {
    optionalElements.distributionMainnetAckFees.addEventListener(
      "change",
      handlers.onDistributionChecklistChange,
    );
  }

  if (optionalElements.distributionMainnetAckIrreversible) {
    optionalElements.distributionMainnetAckIrreversible.addEventListener(
      "change",
      handlers.onDistributionChecklistChange,
    );
  }

  if (optionalElements.distributionPreflightBtn) {
    optionalElements.distributionPreflightBtn.addEventListener(
      "click",
      handlers.onRunPreflight,
    );
  }

  if (optionalElements.distributionStartBtn) {
    optionalElements.distributionStartBtn.addEventListener(
      "click",
      handlers.onStartDistributionStub,
    );
  }
}

export function bindTabEvents(optionalElements, handlers) {
  if (optionalElements.toolTabMintTestToken) {
    optionalElements.toolTabMintTestToken.addEventListener(
      "click",
      handlers.onToggleMintWorkflow,
    );
  }
}
