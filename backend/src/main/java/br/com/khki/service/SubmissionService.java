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
  private final br.com.khki.repository.ImageRepository images;

  public SubmissionService(SubmissionReceiptRepository receipts, ObjectMapper json, br.com.khki.repository.ImageRepository images) {
    this.receipts = receipts;
    this.json = json;
    this.images = images;
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
    if (!receipt.getAuthorId().equals(authorId) || !receipt.getOperation().equals(operation) || !receipt.getFingerprint().equals(fingerprint)) throw new ApiException(HttpStatus.CONFLICT, "Esta tentativa já foi utilizada com outros dados. Confira suas contribuições antes de reenviar.");
    return receipt.getTargetId();
  }

  public void remember(UUID key, UUID authorId, String operation, String fingerprint, TargetType type, UUID targetId) {
    if (key == null) return;
    var receipt = new SubmissionReceipt();
    receipt.setId(key);
    receipt.setAuthorId(authorId);
    receipt.setOperation(operation);
    receipt.setFingerprint(fingerprint);
    receipt.setTargetType(type);
    receipt.setTargetId(targetId);
    receipt.setReference(ContentReference.of(type, targetId, type == TargetType.PHOTO && images.findById(targetId).orElseThrow(ApiException::missing).getRegistrationAttachment()));
    receipts.save(receipt);
  }

  public SubmissionReceipt own(UUID key, UUID authorId) {
    return receipts
      .findById(key)
      .filter(value -> value.getAuthorId().equals(authorId))
      .orElseThrow(ApiException::missing);
  }
}
