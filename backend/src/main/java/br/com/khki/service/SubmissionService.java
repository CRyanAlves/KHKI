package br.com.khki.service;

import br.com.khki.api.ApiException;
import br.com.khki.domain.*;
import br.com.khki.repository.SubmissionReceiptRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SubmissionService {

  private final SubmissionReceiptRepository receipts;
  private final ObjectMapper json;

  public SubmissionService(SubmissionReceiptRepository receipts, ObjectMapper json) {
    this.receipts = receipts;
    this.json = json;
  }

  public String fingerprint(Object request) {
    try {
      return digest(json.writeValueAsBytes(request));
    } catch (java.io.IOException exception) {
      throw new IllegalStateException("Não foi possível validar a tentativa de envio.");
    }
  }

  public String digest(byte[] data) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("Validação de envio indisponível.");
    }
  }

  public UUID replay(UUID key, UUID authorId, String operation, String fingerprint) {
    if (key == null) return null;
    var receipt = receipts.findById(key).orElse(null);
    if (receipt == null) return null;
    if (!receipt.authorId.equals(authorId) || !receipt.operation.equals(operation) || !receipt.fingerprint.equals(fingerprint)) throw new ApiException(HttpStatus.CONFLICT, "Esta tentativa já foi utilizada com outros dados. Confira suas contribuições antes de reenviar.");
    return receipt.targetId;
  }

  public void remember(UUID key, UUID authorId, String operation, String fingerprint, TargetType type, UUID targetId) {
    if (key == null) return;
    var receipt = new SubmissionReceipt();
    receipt.id = key;
    receipt.authorId = authorId;
    receipt.operation = operation;
    receipt.fingerprint = fingerprint;
    receipt.targetType = type;
    receipt.targetId = targetId;
    receipts.save(receipt);
  }

  public SubmissionReceipt own(UUID key, UUID authorId) {
    return receipts
      .findById(key)
      .filter(value -> value.authorId.equals(authorId))
      .orElseThrow(ApiException::missing);
  }
}
